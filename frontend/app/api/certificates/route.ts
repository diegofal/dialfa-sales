import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { uploadCertificateFile, getFileExtension, isAllowedFileType } from '@/lib/storage/supabase'
import { CertificateResponse } from '@/types/certificate'
import { Prisma } from '@prisma/client'

// Type for certificate with included relations
type CertificateWithColadas = Prisma.certificatesGetPayload<{
  include: {
    certificate_coladas: {
      include: {
        colada: true
      }
    }
  }
}>

// Serialize bigints for JSON response
function serializeCertificate(cert: CertificateWithColadas): CertificateResponse {
  return {
    id: cert.id.toString(),
    file_name: cert.file_name,
    storage_path: cert.storage_path,
    original_path: cert.original_path,
    file_type: cert.file_type,
    file_size_bytes: cert.file_size_bytes?.toString() || null,
    category: cert.category,
    notes: cert.notes,
    created_at: cert.created_at.toISOString(),
    updated_at: cert.updated_at.toISOString(),
    coladas: cert.certificate_coladas?.map((cc) => ({
      id: cc.colada.id.toString(),
      colada_number: cc.colada.colada_number,
      description: cc.colada.description,
      supplier: cc.colada.supplier,
      material_type: cc.colada.material_type,
      created_at: cc.colada.created_at.toISOString(),
      updated_at: cc.colada.updated_at.toISOString(),
    })) || []
  }
}

/**
 * GET /api/certificates
 * Search and list certificates with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const colada = searchParams.get('colada')
    const category = searchParams.get('category')
    const fileType = searchParams.get('file_type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.certificatesWhereInput = {
      deleted_at: null,
    }

    if (category) {
      where.category = category
    }

    if (fileType) {
      where.file_type = fileType
    }

    if (colada) {
      where.certificate_coladas = {
        some: {
          colada: {
            colada_number: {
              contains: colada,
              mode: 'insensitive'
            }
          }
        }
      }
    }

    // Get certificates with coladas
    const [certificates, total] = await Promise.all([
      prisma.certificates.findMany({
        where,
        include: {
          certificate_coladas: {
            include: {
              colada: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      }),
      prisma.certificates.count({ where })
    ])

    return NextResponse.json({
      data: certificates.map(serializeCertificate),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching certificates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/certificates
 * Upload a new certificate file
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const coladasJson = formData.get('coladas') as string | null
    const category = formData.get('category') as string | null
    const notes = formData.get('notes') as string | null

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!isAllowedFileType(file.name)) {
      return NextResponse.json(
        { error: `File type not allowed: ${getFileExtension(file.name)}` },
        { status: 400 }
      )
    }

    // Parse coladas
    let coladaNumbers: string[] = []
    if (coladasJson) {
      try {
        coladaNumbers = JSON.parse(coladasJson)
        if (!Array.isArray(coladaNumbers)) {
          coladaNumbers = [coladaNumbers]
        }
      } catch {
        // Try splitting by comma
        coladaNumbers = coladasJson.split(',').map(s => s.trim()).filter(Boolean)
      }
    }

    // Upload file to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const { storagePath } = await uploadCertificateFile(fileBuffer, file.name, category)

    // Find or create coladas
    const coladaRecords = await Promise.all(
      coladaNumbers.map(async (coladaNumber) => {
        return prisma.coladas.upsert({
          where: { colada_number: coladaNumber.toUpperCase() },
          create: { colada_number: coladaNumber.toUpperCase() },
          update: {}
        })
      })
    )

    // Create certificate record
    const certificate = await prisma.certificates.create({
      data: {
        file_name: file.name,
        storage_path: storagePath,
        file_type: getFileExtension(file.name),
        file_size_bytes: BigInt(file.size),
        category,
        notes,
        certificate_coladas: {
          create: coladaRecords.map(colada => ({
            colada_id: colada.id
          }))
        }
      },
      include: {
        certificate_coladas: {
          include: {
            colada: true
          }
        }
      }
    })

    return NextResponse.json(serializeCertificate(certificate), { status: 201 })
  } catch (error) {
    console.error('Error uploading certificate:', error)
    return NextResponse.json(
      { error: 'Failed to upload certificate' },
      { status: 500 }
    )
  }
}

