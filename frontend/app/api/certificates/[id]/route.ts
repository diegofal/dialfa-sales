import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCertificateSignedUrl, deleteCertificateFile } from '@/lib/storage/supabase'

/**
 * GET /api/certificates/[id]
 * Get a single certificate with signed URL for download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const certificateId = BigInt(id)

    const certificate = await prisma.certificates.findUnique({
      where: { 
        id: certificateId,
        deleted_at: null
      },
      include: {
        certificate_coladas: {
          include: {
            colada: true
          }
        }
      }
    })

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Get signed URL for download/preview
    const signedUrl = await getCertificateSignedUrl(certificate.storage_path)

    return NextResponse.json({
      id: certificate.id.toString(),
      file_name: certificate.file_name,
      storage_path: certificate.storage_path,
      original_path: certificate.original_path,
      file_type: certificate.file_type,
      file_size_bytes: certificate.file_size_bytes?.toString() || null,
      category: certificate.category,
      notes: certificate.notes,
      created_at: certificate.created_at.toISOString(),
      updated_at: certificate.updated_at.toISOString(),
      signed_url: signedUrl,
      coladas: certificate.certificate_coladas.map(cc => ({
        id: cc.colada.id.toString(),
        colada_number: cc.colada.colada_number,
        description: cc.colada.description,
        supplier: cc.colada.supplier,
        material_type: cc.colada.material_type,
        created_at: cc.colada.created_at.toISOString(),
        updated_at: cc.colada.updated_at.toISOString(),
      }))
    })
  } catch (error) {
    console.error('Error fetching certificate:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificate' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/certificates/[id]
 * Soft delete a certificate (and remove from storage)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const certificateId = BigInt(id)

    const certificate = await prisma.certificates.findUnique({
      where: { 
        id: certificateId,
        deleted_at: null
      }
    })

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Delete from storage
    try {
      await deleteCertificateFile(certificate.storage_path)
    } catch (storageError) {
      console.error('Error deleting file from storage:', storageError)
      // Continue with soft delete even if storage delete fails
    }

    // Soft delete in database
    await prisma.certificates.update({
      where: { id: certificateId },
      data: { deleted_at: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting certificate:', error)
    return NextResponse.json(
      { error: 'Failed to delete certificate' },
      { status: 500 }
    )
  }
}



