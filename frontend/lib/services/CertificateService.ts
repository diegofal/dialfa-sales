import * as fs from 'fs/promises';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';
import {
  uploadCertificateFile,
  getFileExtension,
  isAllowedFileType,
  getCertificateSignedUrl,
  deleteCertificateFile,
} from '@/lib/storage/supabase';
import { logger } from '@/lib/utils/logger';
import { CertificateResponse } from '@/types/certificate';

// ─── Constants ────────────────────────────────────────────────────────────────

const CERTIFICATES_SOURCE_DIR = 'G:\\Shared drives\\Dialfa\\CERTIFICADOS DIALFA';

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CertificateListParams {
  colada?: string;
  category?: string;
  fileType?: string;
  page: number;
  limit: number;
}

interface SyncStats {
  totalInExcel: number;
  newUploaded: number;
  coladasUpdated: number;
  alreadyExisted: number;
  fileNotFound: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
}

type CertificateWithColadas = Prisma.certificatesGetPayload<{
  include: {
    certificate_coladas: {
      include: {
        colada: true;
      };
    };
  };
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    coladas:
      cert.certificate_coladas?.map((cc) => ({
        id: cc.colada.id.toString(),
        colada_number: cc.colada.colada_number,
        description: cc.colada.description,
        supplier: cc.colada.supplier,
        material_type: cc.colada.material_type,
        created_at: cc.colada.created_at.toISOString(),
        updated_at: cc.colada.updated_at.toISOString(),
      })) || [],
  };
}

async function findFileInDirectory(fileName: string, dir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = await findFileInDirectory(fileName, fullPath);
        if (found) return found;
      } else if (entry.isFile() && entry.name === fileName) {
        return fullPath;
      }
    }
  } catch {
    // Ignore access errors
  }

  return null;
}

function getCategoryFromPath(filePath: string): string {
  const relativePath = filePath.replace(CERTIFICATES_SOURCE_DIR, '');
  const parts = relativePath.split(path.sep).filter(Boolean);

  if (parts.length > 0) {
    const folder = parts[0];
    return FOLDER_TO_CATEGORY[folder] || 'ACCESORIOS';
  }

  return 'ACCESORIOS';
}

async function findOrCreateColada(coladaNumber: string) {
  return prisma.coladas.upsert({
    where: { colada_number: coladaNumber },
    create: { colada_number: coladaNumber },
    update: {},
  });
}

async function updateCertificateColadas(
  certificateId: bigint,
  coladaNumbers: string[]
): Promise<boolean> {
  try {
    await prisma.certificate_coladas.deleteMany({
      where: { certificate_id: certificateId },
    });

    if (coladaNumbers.length === 0) return true;

    const coladas = await Promise.all(coladaNumbers.map((num) => findOrCreateColada(num)));

    await prisma.certificate_coladas.createMany({
      data: coladas.map((colada) => ({
        certificate_id: certificateId,
        colada_id: colada.id,
      })),
    });

    return true;
  } catch {
    return false;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function list(params: CertificateListParams) {
  const { colada, category, fileType, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.certificatesWhereInput = {
    deleted_at: null,
  };

  if (category) {
    where.category = category;
  }

  if (fileType) {
    where.file_type = fileType;
  }

  if (colada) {
    where.certificate_coladas = {
      some: {
        colada: {
          colada_number: {
            contains: colada,
            mode: 'insensitive',
          },
        },
      },
    };
  }

  const [certificates, total] = await Promise.all([
    prisma.certificates.findMany({
      where,
      include: {
        certificate_coladas: {
          include: { colada: true },
        },
      },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.certificates.count({ where }),
  ]);

  return {
    data: certificates.map(serializeCertificate),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getById(id: bigint) {
  const certificate = await prisma.certificates.findUnique({
    where: { id },
    include: {
      certificate_coladas: {
        include: { colada: true },
      },
    },
  });

  if (!certificate || certificate.deleted_at) {
    return null;
  }

  const signedUrl = await getCertificateSignedUrl(certificate.storage_path);

  return {
    ...serializeCertificate(certificate),
    signed_url: signedUrl,
  };
}

export async function getDownloadUrl(id: bigint) {
  const certificate = await prisma.certificates.findUnique({
    where: { id, deleted_at: null },
    select: { storage_path: true, file_name: true },
  });

  if (!certificate) {
    return null;
  }

  const signedUrl = await getCertificateSignedUrl(certificate.storage_path);

  return {
    signedUrl,
    fileName: certificate.file_name,
  };
}

export async function upload(
  file: File,
  coladasJson: string | null,
  category: string,
  notes: string | null
) {
  if (!isAllowedFileType(file.name)) {
    return { error: `File type not allowed: ${getFileExtension(file.name)}`, status: 400 };
  }

  // Parse coladas
  let coladaNumbers: string[] = [];
  if (coladasJson) {
    try {
      coladaNumbers = JSON.parse(coladasJson);
      if (!Array.isArray(coladaNumbers)) {
        coladaNumbers = [coladaNumbers];
      }
    } catch {
      coladaNumbers = coladasJson
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await uploadCertificateFile(fileBuffer, file.name, category);

  // Find or create coladas
  const coladaRecords = await Promise.all(
    coladaNumbers.map((coladaNumber) => {
      return prisma.coladas.upsert({
        where: { colada_number: coladaNumber.toUpperCase() },
        create: { colada_number: coladaNumber.toUpperCase() },
        update: {},
      });
    })
  );

  const certificate = await prisma.certificates.create({
    data: {
      file_name: file.name,
      storage_path: storagePath,
      file_type: getFileExtension(file.name),
      file_size_bytes: BigInt(file.size),
      category,
      notes,
      certificate_coladas: {
        create: coladaRecords.map((colada) => ({
          colada_id: colada.id,
        })),
      },
    },
    include: {
      certificate_coladas: {
        include: { colada: true },
      },
    },
  });

  return { data: serializeCertificate(certificate), status: 201 };
}

export async function remove(id: bigint, request: NextRequest) {
  const certificate = await prisma.certificates.findUnique({
    where: { id, deleted_at: null },
  });

  if (!certificate) {
    return { error: 'Certificate not found', status: 404 };
  }

  // Delete from storage
  try {
    await deleteCertificateFile(certificate.storage_path);
  } catch (storageError) {
    logger.error('Error deleting file from storage', {}, storageError as Error);
  }

  const tracker = new ChangeTracker();
  tracker.trackDelete('certificate', id, certificate);

  await prisma.certificates.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.CERTIFICATE_DELETE,
    description: `Certificado ${certificate.file_name} eliminado`,
    entityType: 'certificate',
    entityId: certificate.id,
    details: { fileName: certificate.file_name },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { status: 200 };
}

export async function syncFromExcel(file: File, request: NextRequest) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];

  // Build file → coladas map
  const fileToColadas = new Map<string, string[]>();
  let currentFile = '';

  for (const row of data) {
    const fileName = row['NOMBRE DEL ARCHIVO  '];
    const colada = row['COLADA'];

    if (fileName && fileName.toString().trim()) {
      currentFile = fileName.toString().trim();
      if (!fileToColadas.has(currentFile)) {
        fileToColadas.set(currentFile, []);
      }
    }

    if (colada && colada.toString().trim() && currentFile) {
      const coladaStr = colada.toString().trim();
      const existing = fileToColadas.get(currentFile);
      if (existing && !existing.includes(coladaStr)) {
        existing.push(coladaStr);
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
    errors: [],
  };

  for (const [fileName, coladaNumbers] of fileToColadas) {
    try {
      const existing = await prisma.certificates.findFirst({
        where: { file_name: fileName, deleted_at: null },
        include: {
          certificate_coladas: {
            include: { colada: true },
          },
        },
      });

      if (existing) {
        const currentColadas = existing.certificate_coladas
          .map((cc) => cc.colada.colada_number)
          .sort();
        const newColadas = [...coladaNumbers].sort();

        const needsUpdate =
          currentColadas.length !== newColadas.length ||
          !currentColadas.every((val, idx) => val === newColadas[idx]);

        if (needsUpdate) {
          await updateCertificateColadas(existing.id, coladaNumbers);
          stats.coladasUpdated++;
        } else {
          stats.alreadyExisted++;
        }
        continue;
      }

      // New file: find and upload
      const filePath = await findFileInDirectory(fileName, CERTIFICATES_SOURCE_DIR);

      if (!filePath) {
        stats.fileNotFound++;
        stats.errors.push({ file: fileName, error: 'No encontrado en sistema de archivos' });
        continue;
      }

      if (!isAllowedFileType(fileName)) {
        stats.failed++;
        continue;
      }

      const fileBuffer = await fs.readFile(filePath);

      if (fileBuffer.length > 50 * 1024 * 1024) {
        stats.failed++;
        stats.errors.push({ file: fileName, error: 'Archivo excede 50MB' });
        continue;
      }

      const category = getCategoryFromPath(filePath);

      const { storagePath } = await uploadCertificateFile(fileBuffer, fileName, category);

      const coladas = await Promise.all(coladaNumbers.map((num) => findOrCreateColada(num)));

      await prisma.certificates.create({
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

      stats.newUploaded++;
    } catch (error) {
      stats.failed++;
      stats.errors.push({
        file: fileName,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  await logActivity({
    request,
    operation: OPERATIONS.CERTIFICATE_SYNC,
    description: `Sincronización de certificados completada: ${stats.newUploaded} nuevos, ${stats.coladasUpdated} actualizados`,
    entityType: 'certificate',
    details: stats as unknown as Record<string, unknown>,
  });

  return stats;
}

// ─── Coladas ──────────────────────────────────────────────────────────────────

export interface ColadaListParams {
  page: number;
  limit: number;
  search?: string;
}

export async function listColadas(params: ColadaListParams) {
  const { page, limit, search } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.coladasWhereInput = {};
  if (search) {
    where.colada_number = { contains: search, mode: 'insensitive' };
  }

  const [coladas, total] = await Promise.all([
    prisma.coladas.findMany({
      where,
      include: {
        _count: {
          select: {
            certificate_coladas: {
              where: { certificates: { deleted_at: null } },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { colada_number: 'asc' },
    }),
    prisma.coladas.count({ where }),
  ]);

  return {
    data: coladas.map((colada) => ({
      id: colada.id.toString(),
      colada_number: colada.colada_number,
      description: colada.description,
      supplier: colada.supplier,
      material_type: colada.material_type,
      created_at: colada.created_at.toISOString(),
      updated_at: colada.updated_at.toISOString(),
      certificates_count: colada._count.certificate_coladas,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createColada(
  data: { colada_number: string; description?: string; supplier?: string; material_type?: string },
  request: NextRequest
) {
  if (!data.colada_number) {
    return { error: 'Colada number is required', status: 400 };
  }

  const existing = await prisma.coladas.findUnique({
    where: { colada_number: data.colada_number.toUpperCase() },
  });

  if (existing) {
    return { error: 'Colada already exists', status: 409 };
  }

  const colada = await prisma.coladas.create({
    data: {
      colada_number: data.colada_number.toUpperCase(),
      description: data.description,
      supplier: data.supplier,
      material_type: data.material_type,
    },
  });

  await logActivity({
    request,
    operation: OPERATIONS.COLADA_CREATE,
    description: `Colada ${colada.colada_number} creada`,
    entityType: 'colada',
    entityId: colada.id,
    details: {
      coladaNumber: colada.colada_number,
      supplier: colada.supplier,
      materialType: colada.material_type,
    },
  });

  return {
    data: {
      id: colada.id.toString(),
      colada_number: colada.colada_number,
      description: colada.description,
      supplier: colada.supplier,
      material_type: colada.material_type,
      created_at: colada.created_at.toISOString(),
      updated_at: colada.updated_at.toISOString(),
    },
    status: 201,
  };
}
