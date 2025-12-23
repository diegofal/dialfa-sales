import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import * as fs from 'fs/promises'
import * as path from 'path'
import { prisma } from '@/lib/db'
import { uploadCertificateFile, getFileExtension, isAllowedFileType } from '@/lib/storage/supabase'
import { OPERATIONS } from '@/lib/constants/operations'
import { logActivity } from '@/lib/services/activityLogger'

const CERTIFICATES_SOURCE_DIR = 'G:\\Shared drives\\Dialfa\\CERTIFICADOS DIALFA'

const FOLDER_TO_CATEGORY: Record<string, string> = {
  'ACCESORIOS 2023': 'ACCESORIOS',
  'ACCESORIOS': 'ACCESORIOS',
  'BRIDAS 2023': 'BRIDAS',
  'BRIDAS': 'BRIDAS',
  'ESPARRAGOS 2023': 'ESPARRAGOS',
  'ESPARRAGOS': 'ESPARRAGOS',
  'Forjado 2023': 'FORJADO',
  'FORJADO': 'FORJADO',
  'Certificados': 'ACCESORIOS'
}

interface SyncStats {
  totalInExcel: number
  newUploaded: number
  coladasUpdated: number
  alreadyExisted: number
  fileNotFound: number
  failed: number
  errors: Array<{ file: string; error: string }>
}

/**
 * Busca un archivo recursivamente
 */
async function findFileInDirectory(fileName: string, dir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        const found = await findFileInDirectory(fileName, fullPath)
        if (found) return found
      } else if (entry.isFile() && entry.name === fileName) {
        return fullPath
      }
    }
  } catch {
    // Ignorar errores de acceso
  }
  
  return null
}

/**
 * Obtiene categoría desde la ruta
 */
function getCategoryFromPath(filePath: string): string {
  const relativePath = filePath.replace(CERTIFICATES_SOURCE_DIR, '')
  const parts = relativePath.split(path.sep).filter(Boolean)
  
  if (parts.length > 0) {
    const folder = parts[0]
    return FOLDER_TO_CATEGORY[folder] || 'ACCESORIOS'
  }
  
  return 'ACCESORIOS'
}

/**
 * Crea o encuentra colada
 */
async function findOrCreateColada(coladaNumber: string) {
  return prisma.coladas.upsert({
    where: { colada_number: coladaNumber },
    create: { colada_number: coladaNumber },
    update: {}
  })
}

/**
 * Actualiza coladas de un certificado
 */
async function updateCertificateColadas(certificateId: bigint, coladaNumbers: string[]): Promise<boolean> {
  try {
    await prisma.certificate_coladas.deleteMany({
      where: { certificate_id: certificateId }
    })
    
    if (coladaNumbers.length === 0) return true
    
    const coladas = await Promise.all(
      coladaNumbers.map(num => findOrCreateColada(num))
    )
    
    await prisma.certificate_coladas.createMany({
      data: coladas.map(colada => ({
        certificate_id: certificateId,
        colada_id: colada.id
      }))
    })
    
    return true
  } catch {
    return false
  }
}

/**
 * POST /api/certificates/sync
 * Sincroniza certificados desde archivo Excel
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No se recibió archivo' },
        { status: 400 }
      )
    }
    
    // Leer archivo Excel
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[]
    
    // Construir mapa de archivos → coladas
    const fileToColadas = new Map<string, string[]>()
    let currentFile = ''
    
    for (const row of data) {
      const fileName = row['NOMBRE DEL ARCHIVO  ']
      const colada = row['COLADA']
      
      if (fileName && fileName.toString().trim()) {
        currentFile = fileName.toString().trim()
        if (!fileToColadas.has(currentFile)) {
          fileToColadas.set(currentFile, [])
        }
      }
      
      if (colada && colada.toString().trim() && currentFile) {
        const coladaStr = colada.toString().trim()
        const existing = fileToColadas.get(currentFile)
        if (existing && !existing.includes(coladaStr)) {
          existing.push(coladaStr)
        }
      }
    }
    
    const stats: SyncStats = {
      totalInExcel: fileToColadas.size,
      newUploaded: 0,
      coladasUpdated: 0,
      alreadyExisted: 0,
      fileNotFound: 0,
      failed: 0,
      errors: []
    }
    
    // Procesar cada archivo
    for (const [fileName, coladaNumbers] of fileToColadas) {
      try {
        // Verificar si existe
        const existing = await prisma.certificates.findFirst({
          where: { 
            file_name: fileName,
            deleted_at: null
          },
          include: {
            certificate_coladas: {
              include: { colada: true }
            }
          }
        })
        
        if (existing) {
          // Verificar coladas
          const currentColadas = existing.certificate_coladas
            .map(cc => cc.colada.colada_number)
            .sort()
          const newColadas = [...coladaNumbers].sort()
          
          const needsUpdate = 
            currentColadas.length !== newColadas.length ||
            !currentColadas.every((val, idx) => val === newColadas[idx])
          
          if (needsUpdate) {
            await updateCertificateColadas(existing.id, coladaNumbers)
            stats.coladasUpdated++
          } else {
            stats.alreadyExisted++
          }
          continue
        }
        
        // Archivo nuevo: buscar y subir
        const filePath = await findFileInDirectory(fileName, CERTIFICATES_SOURCE_DIR)
        
        if (!filePath) {
          stats.fileNotFound++
          stats.errors.push({
            file: fileName,
            error: 'No encontrado en sistema de archivos'
          })
          continue
        }
        
        if (!isAllowedFileType(fileName)) {
          stats.failed++
          continue
        }
        
        const fileBuffer = await fs.readFile(filePath)
        
        // Verificar tamaño (50MB)
        if (fileBuffer.length > 50 * 1024 * 1024) {
          stats.failed++
          stats.errors.push({
            file: fileName,
            error: 'Archivo excede 50MB'
          })
          continue
        }
        
        const category = getCategoryFromPath(filePath)
        
        // Subir a Supabase
        const { storagePath } = await uploadCertificateFile(
          fileBuffer,
          fileName,
          category
        )
        
        // Crear coladas
        const coladas = await Promise.all(
          coladaNumbers.map(num => findOrCreateColada(num))
        )
        
        // Registrar en DB
        await prisma.certificates.create({
          data: {
            file_name: fileName,
            storage_path: storagePath,
            original_path: filePath,
            file_type: getFileExtension(fileName),
            file_size_bytes: BigInt(fileBuffer.length),
            category,
            certificate_coladas: {
              create: coladas.map(colada => ({
                colada_id: colada.id
              }))
            }
          }
        })
        
        stats.newUploaded++
      } catch (error) {
        stats.failed++
        stats.errors.push({
          file: fileName,
          error: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }
    
    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.CERTIFICATE_SYNC,
      description: `Sincronización de certificados completada: ${stats.newUploaded} nuevos, ${stats.coladasUpdated} actualizados`,
      entityType: 'certificate',
      details: stats
    });
    
    return NextResponse.json({ success: true, stats })
  } catch (error) {
    console.error('Error en sincronización:', error)
    return NextResponse.json(
      { error: 'Error procesando archivo Excel' },
      { status: 500 }
    )
  }
}

