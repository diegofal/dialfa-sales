/**
 * Script para sincronizar certificados desde el archivo Excel
 *
 * Funciones:
 * 1. Lee el Excel actualizado
 * 2. Sube archivos nuevos que no estén en la base de datos
 * 3. Actualiza coladas de certificados existentes
 *
 * Uso:
 *   npm run sync:excel
 *   npm run sync:excel /ruta/al/archivo.xlsx
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import {
  uploadCertificateFile,
  getFileExtension,
  isAllowedFileType,
} from '../lib/storage/supabase';

// Configuración
const CERTIFICATES_SOURCE_DIR = 'G:\\Shared drives\\Dialfa\\CERTIFICADOS DIALFA';
const DEFAULT_EXCEL_PATH = 'C:\\Users\\User\\Desktop\\Certificados.xlsx';

// Mapeo de carpetas a categorías
const FOLDER_TO_CATEGORY: Record<string, string> = {
  'ACCESORIOS 2023': 'ACCESORIOS',
  ACCESORIOS: 'ACCESORIOS',
  'BRIDAS 2023': 'BRIDAS',
  BRIDAS: 'BRIDAS',
  'ESPARRAGOS 2023': 'ESPARRAGOS',
  ESPARRAGOS: 'ESPARRAGOS',
  'Forjado 2023': 'FORJADO',
  FORJADO: 'FORJADO',
  Certificados: 'ACCESORIOS',
};

const prisma = new PrismaClient();

interface Stats {
  totalInExcel: number;
  newUploaded: number;
  coladasUpdated: number;
  alreadyExisted: number;
  fileNotFound: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
}

const stats: Stats = {
  totalInExcel: 0,
  newUploaded: 0,
  coladasUpdated: 0,
  alreadyExisted: 0,
  fileNotFound: 0,
  failed: 0,
  errors: [],
};

/**
 * Lee el archivo Excel y construye un mapa de archivos → coladas
 */
async function loadExcelMapping(excelPath: string): Promise<Map<string, string[]>> {
  const fileToColadas = new Map<string, string[]>();

  try {
    console.log(`📊 Leyendo Excel: ${excelPath}\n`);

    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    let currentFile = '';

    for (const row of data) {
      const fileName = row['NOMBRE DEL ARCHIVO  ']; // Nota: columna tiene espacios
      const colada = row['COLADA'];

      // Si hay nombre de archivo, actualizar el archivo actual
      if (fileName && fileName.toString().trim()) {
        currentFile = fileName.toString().trim();
        if (!fileToColadas.has(currentFile)) {
          fileToColadas.set(currentFile, []);
        }
      }

      // Si hay colada, agregarla al archivo actual
      if (colada && colada.toString().trim() && currentFile) {
        const coladaStr = colada.toString().trim();
        const existing = fileToColadas.get(currentFile);
        if (existing && !existing.includes(coladaStr)) {
          existing.push(coladaStr);
        }
      }
    }

    stats.totalInExcel = fileToColadas.size;
    console.log(`✅ Excel cargado: ${fileToColadas.size} archivos mapeados\n`);

    return fileToColadas;
  } catch (error) {
    console.error('❌ Error leyendo Excel:', error);
    throw error;
  }
}

/**
 * Busca un archivo en el sistema de archivos
 */
async function findFileInDirectory(fileName: string, dir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Buscar recursivamente
        const found = await findFileInDirectory(fileName, fullPath);
        if (found) return found;
      } else if (entry.isFile() && entry.name === fileName) {
        return fullPath;
      }
    }
  } catch (error) {
    // Ignorar errores de acceso a directorios
  }

  return null;
}

/**
 * Obtiene la categoría basándose en la ruta del archivo
 */
function getCategoryFromPath(filePath: string): string {
  const relativePath = filePath.replace(CERTIFICATES_SOURCE_DIR, '');
  const parts = relativePath.split(path.sep).filter(Boolean);

  if (parts.length > 0) {
    const folder = parts[0];
    return FOLDER_TO_CATEGORY[folder] || 'ACCESORIOS';
  }

  return 'ACCESORIOS';
}

/**
 * Crea o encuentra una colada en la base de datos
 */
async function findOrCreateColada(coladaNumber: string) {
  return prisma.coladas.upsert({
    where: { colada_number: coladaNumber },
    create: { colada_number: coladaNumber },
    update: {},
  });
}

/**
 * Actualiza las coladas de un certificado existente
 */
async function updateCertificateColadas(
  certificateId: bigint,
  coladaNumbers: string[]
): Promise<boolean> {
  try {
    // Eliminar relaciones existentes
    await prisma.certificate_coladas.deleteMany({
      where: { certificate_id: certificateId },
    });

    if (coladaNumbers.length === 0) {
      return true;
    }

    // Crear o encontrar coladas
    const coladas = await Promise.all(coladaNumbers.map((num) => findOrCreateColada(num)));

    // Crear nuevas relaciones
    await prisma.certificate_coladas.createMany({
      data: coladas.map((colada) => ({
        certificate_id: certificateId,
        colada_id: colada.id,
      })),
    });

    return true;
  } catch (error) {
    console.error(
      `    ❌ Error actualizando coladas: ${error instanceof Error ? error.message : 'Unknown'}`
    );
    return false;
  }
}

/**
 * Procesa un archivo del Excel
 */
async function processFileFromExcel(fileName: string, coladaNumbers: string[]): Promise<void> {
  try {
    // Verificar si ya existe en la base de datos
    const existing = await prisma.certificates.findFirst({
      where: {
        file_name: fileName,
        deleted_at: null,
      },
      include: {
        certificate_coladas: {
          include: {
            colada: true,
          },
        },
      },
    });

    if (existing) {
      // Archivo existe: verificar si las coladas cambiaron
      const currentColadas = existing.certificate_coladas
        .map((cc) => cc.colada.colada_number)
        .sort();
      const newColadas = [...coladaNumbers].sort();

      const needsUpdate =
        currentColadas.length !== newColadas.length ||
        !currentColadas.every((val, idx) => val === newColadas[idx]);

      if (needsUpdate) {
        console.log(`  🔄 Actualizando coladas...`);
        console.log(
          `     Antes: ${currentColadas.length > 0 ? currentColadas.join(', ') : 'ninguna'}`
        );
        console.log(`     Ahora: ${newColadas.length > 0 ? newColadas.join(', ') : 'ninguna'}`);

        const success = await updateCertificateColadas(existing.id, coladaNumbers);
        if (success) {
          console.log(`     ✅ Coladas actualizadas`);
          stats.coladasUpdated++;
        } else {
          stats.failed++;
        }
      } else {
        console.log(`  ⏭️  Sin cambios`);
        stats.alreadyExisted++;
      }
      return;
    }

    // Archivo NO existe: buscar y subir
    console.log(`  🔍 Buscando archivo en sistema...`);
    const filePath = await findFileInDirectory(fileName, CERTIFICATES_SOURCE_DIR);

    if (!filePath) {
      console.log(`  ⚠️  Archivo no encontrado en sistema`);
      stats.fileNotFound++;
      stats.errors.push({
        file: fileName,
        error: 'Archivo no encontrado en el sistema de archivos',
      });
      return;
    }

    console.log(`  📂 Encontrado: ${filePath.replace(CERTIFICATES_SOURCE_DIR, '')}`);

    // Verificar tipo de archivo
    if (!isAllowedFileType(fileName)) {
      console.log(`  ⚠️  Tipo de archivo no permitido`);
      stats.failed++;
      return;
    }

    // Leer archivo
    const fileBuffer = await fs.readFile(filePath);
    const category = getCategoryFromPath(filePath);
    const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);

    // Verificar tamaño (Supabase límite: 50MB)
    if (fileBuffer.length > 50 * 1024 * 1024) {
      console.log(`  ⚠️  Archivo muy grande (${fileSizeMB} MB, límite: 50 MB)`);
      stats.failed++;
      stats.errors.push({
        file: fileName,
        error: `Archivo excede 50MB (${fileSizeMB} MB)`,
      });
      return;
    }

    console.log(`  📁 Categoría: ${category}`);
    console.log(`  📊 Tamaño: ${fileSizeMB} MB`);
    console.log(`  🔢 Coladas: ${coladaNumbers.length > 0 ? coladaNumbers.join(', ') : 'ninguna'}`);
    console.log(`  ⬆️  Subiendo a Supabase...`);

    // Subir a Supabase
    const { storagePath } = await uploadCertificateFile(fileBuffer, fileName, category);

    console.log(`  ✅ Subido: ${storagePath}`);

    // Crear/obtener coladas
    const coladas = await Promise.all(coladaNumbers.map((num) => findOrCreateColada(num)));

    // Registrar en base de datos
    const certificate = await prisma.certificates.create({
      data: {
        file_name: fileName,
        storage_path: storagePath,
        original_path: filePath,
        file_type: getFileExtension(fileName),
        file_size_bytes: BigInt(fileBuffer.length),
        category,
        certificate_coladas: {
          create: coladas.map((colada) => ({
            colada_id: colada.id,
          })),
        },
      },
    });

    console.log(`  💾 Registrado en DB: ID ${certificate.id}`);
    stats.newUploaded++;
  } catch (error) {
    console.error(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    stats.failed++;
    stats.errors.push({
      file: fileName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Script principal
 */
async function main() {
  const excelPath = process.argv[2] || DEFAULT_EXCEL_PATH;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🔄 SINCRONIZACIÓN DESDE EXCEL                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`📂 Directorio de certificados: ${CERTIFICATES_SOURCE_DIR}`);
  console.log(`📊 Archivo Excel: ${excelPath}\n`);

  try {
    // Verificar que el Excel existe
    await fs.access(excelPath);
  } catch {
    console.error(`❌ No se puede acceder al Excel: ${excelPath}`);
    process.exit(1);
  }

  try {
    // Cargar mapeo del Excel
    const excelMapping = await loadExcelMapping(excelPath);

    if (excelMapping.size === 0) {
      console.log('⚠️  No hay archivos en el Excel');
      return;
    }

    console.log('🚀 Iniciando sincronización...\n');
    console.log('='.repeat(60));

    // Procesar cada archivo del Excel
    let count = 0;
    for (const [fileName, coladaNumbers] of excelMapping) {
      count++;
      console.log(`\n[${count}/${excelMapping.size}] ${fileName}`);

      await processFileFromExcel(fileName, coladaNumbers);

      // Pausa pequeña para evitar rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE SINCRONIZACIÓN');
    console.log('='.repeat(60));
    console.log(`Total en Excel:           ${stats.totalInExcel}`);
    console.log(`🆕 Nuevos subidos:         ${stats.newUploaded}`);
    console.log(`🔄 Coladas actualizadas:   ${stats.coladasUpdated}`);
    console.log(`✅ Sin cambios:            ${stats.alreadyExisted}`);
    console.log(`⚠️  Archivo no encontrado:  ${stats.fileNotFound}`);
    console.log(`❌ Fallidos:               ${stats.failed}`);
    console.log('='.repeat(60));

    if (stats.errors.length > 0) {
      console.log('\n⚠️  ARCHIVOS CON PROBLEMAS:');
      stats.errors.slice(0, 10).forEach((err, i) => {
        console.log(`${i + 1}. ${err.file}`);
        console.log(`   ${err.error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`   ... y ${stats.errors.length - 10} más`);
      }
    }

    console.log('\n✅ Sincronización completada');
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
main();
