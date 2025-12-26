import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCertificateSignedUrl } from '@/lib/storage/supabase'

/**
 * GET /api/certificates/[id]/download
 * Get a signed URL for downloading a certificate file
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
      select: {
        storage_path: true,
        file_name: true
      }
    })

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Get signed URL for download (valid for 1 hour)
    const signedUrl = await getCertificateSignedUrl(certificate.storage_path)

    return NextResponse.json({
      signedUrl,
      fileName: certificate.file_name
    })
  } catch (error) {
    console.error('Error getting download URL:', error)
    return NextResponse.json(
      { error: 'Failed to get download URL' },
      { status: 500 }
    )
  }
}







