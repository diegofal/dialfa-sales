import { createClient } from '@supabase/supabase-js'

// Validate environment variables
if (!process.env.SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable')
}

if (!process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_KEY environment variable')
}

// Create Supabase client with service role key (server-side only)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
)

const BUCKET_NAME = 'certificates'

// Allowed file extensions for certificates
const ALLOWED_EXTENSIONS = [
  'pdf', 'jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'bmp',
  'xls', 'xlsx', 'doc', 'docx'
]

/**
 * Get MIME type from file extension
 */
function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    bmp: 'image/bmp',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

/**
 * Validate file extension
 */
export function isAllowedFileType(fileName: string): boolean {
  const ext = getFileExtension(fileName)
  return ALLOWED_EXTENSIONS.includes(ext)
}

/**
 * Sanitize filename for storage
 */
function sanitizeFileName(fileName: string): string {
  // Replace special characters with underscores, keep extension
  const ext = getFileExtension(fileName)
  const nameWithoutExt = fileName.slice(0, -(ext.length + 1))
  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${sanitized}.${ext}`
}

/**
 * Upload a certificate file to Supabase Storage
 */
export async function uploadCertificateFile(
  fileBuffer: Buffer,
  fileName: string,
  category: string
): Promise<{ storagePath: string; url: string }> {
  // Validate file type
  if (!isAllowedFileType(fileName)) {
    throw new Error(`File type not allowed: ${getFileExtension(fileName)}`)
  }

  // Create unique path with timestamp
  const safeName = sanitizeFileName(fileName)
  const storagePath = `${category}/${Date.now()}_${safeName}`
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: getMimeType(fileName),
      upsert: false
    })
  
  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }
  
  // Return the storage path (we'll generate signed URLs on demand)
  return { 
    storagePath: data.path,
    url: `${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${data.path}`
  }
}

/**
 * Get a signed URL for downloading/viewing a certificate
 * URLs are valid for 1 hour
 */
export async function getCertificateSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600) // 1 hour expiry
  
  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`)
  }
  
  return data.signedUrl
}

/**
 * Get multiple signed URLs at once
 */
export async function getCertificateSignedUrls(
  storagePaths: string[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {}
  
  // Supabase doesn't have batch signed URL, so we do them in parallel
  const promises = storagePaths.map(async (path) => {
    try {
      const url = await getCertificateSignedUrl(path)
      results[path] = url
    } catch {
      results[path] = ''
    }
  })
  
  await Promise.all(promises)
  return results
}

/**
 * Delete a certificate file from storage
 */
export async function deleteCertificateFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath])
  
  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}

/**
 * Check if a file exists in storage
 */
export async function certificateFileExists(storagePath: string): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(storagePath.split('/').slice(0, -1).join('/'), {
      search: storagePath.split('/').pop()
    })
  
  if (error) {
    return false
  }
  
  return data.length > 0
}


