import * as fs from 'fs/promises';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import {
  uploadCertificateFile,
  getFileExtension,
  isAllowedFileType,
  getCertificateSignedUrl,
  deleteCertificateFile,
} from '@/lib/storage/supabase';
import { logActivity } from '@/lib/utils/activityLogger';
import { ChangeTracker } from '@/lib/utils/changeTracker';
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
  parentsLinked: number;
  parentNotFound: number;
  errors: Array<{ file: string; error: string }>;
}

type CertificateWithColadas = Prisma.certificatesGetPayload<{
  include: {
    certificate_coladas: {
      include: {
        colada: true;
      };
    };
    parent: {
      select: {
        id: true;
        file_name: true;
        category: true;
      };
    };
    children: {
      select: {
        id: true;
        file_name: true;
        category: true;
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
    parent: cert.parent
      ? {
          id: cert.parent.id.toString(),
          file_name: cert.parent.file_name,
          category: cert.parent.category,
        }
      : null,
    children:
      cert.children?.map((child) => ({
        id: child.id.toString(),
        file_name: child.file_name,
        category: child.category,
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

  const baseWhere: Prisma.certificatesWhereInput = {
    deleted_at: null,
  };

  if (category) baseWhere.category = category;
  if (fileType) baseWhere.file_type = fileType;

  if (colada) {
    // 1. Encontrar certificados directos con la colada
    const directMatches = await prisma.certificates.findMany({
      where: {
        ...baseWhere,
        certificate_coladas: {
          some: {
            colada: {
              colada_number: { equals: colada, mode: 'insensitive' },
            },
          },
        },
      },
      select: { id: true, parent_id: true },
    });

    // 2. Extraer IDs: directos + padres
    const directIds = directMatches.map((c) => c.id);
    const parentIds = directMatches
      .filter((c) => c.parent_id !== null)
      .map((c) => c.parent_id as bigint);

    // 3. Buscar hijos de certificados directos
    const childrenOfDirects = await prisma.certificates.findMany({
      where: {
        parent_id: { in: directIds },
        deleted_at: null,
      },
      select: { id: true },
    });

    // 4. Buscar TODOS los hijos de los padres incluidos
    const childrenOfParents = await prisma.certificates.findMany({
      where: {
        parent_id: { in: parentIds },
        deleted_at: null,
      },
      select: { id: true },
    });

    // 5. Combinar IDs sin duplicados
    const allIds = Array.from(
      new Set([
        ...directIds,
        ...parentIds,
        ...childrenOfDirects.map((c) => c.id),
        ...childrenOfParents.map((c) => c.id),
      ])
    );

    // 5. Query final
    const where: Prisma.certificatesWhereInput = {
      ...baseWhere,
      id: { in: allIds },
    };

    const [certificates, total] = await Promise.all([
      prisma.certificates.findMany({
        where,
        include: {
          certificate_coladas: { include: { colada: true } },
          parent: {
            select: { id: true, file_name: true, category: true },
          },
          children: {
            where: { deleted_at: null },
            select: { id: true, file_name: true, category: true },
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
  } else {
    // Sin filtro de colada: query normal con parent y children
    const [certificates, total] = await Promise.all([
      prisma.certificates.findMany({
        where: baseWhere,
        include: {
          certificate_coladas: { include: { colada: true } },
          parent: {
            select: { id: true, file_name: true, category: true },
          },
          children: {
            where: { deleted_at: null },
            select: { id: true, file_name: true, category: true },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.certificates.count({ where: baseWhere }),
    ]);

    return {
      data: certificates.map(serializeCertificate),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

export async function getById(id: bigint) {
  const certificate = await prisma.certificates.findUnique({
    where: { id },
    include: {
      certificate_coladas: {
        include: { colada: true },
      },
      parent: {
        select: { id: true, file_name: true, category: true },
      },
      children: {
        where: { deleted_at: null },
        select: { id: true, file_name: true, category: true },
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
      parent: {
        select: { id: true, file_name: true, category: true },
      },
      children: {
        where: { deleted_at: null },
        select: { id: true, file_name: true, category: true },
      },
    },
  });

  return { data: serializeCertificate(certificate), status: 201 };
}

export async function remove(id: bigint, request: NextRequest) {
  const certificate = await prisma.certificates.findUnique({
    where: { id, deleted_at: null },
    include: {
      children: {
        where: { deleted_at: null },
        select: { id: true },
      },
    },
  });

  if (!certificate) {
    return { error: 'Certificate not found', status: 404 };
  }

  // Prevenir eliminación si tiene hijos
  if (certificate.children && certificate.children.length > 0) {
    return {
      error: `No se puede eliminar. Este certificado es padre de ${certificate.children.length} archivo(s). Elimina primero los archivos hijos.`,
      status: 400,
    };
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

  // Build file → metadata map
  interface FileMetadata {
    coladas: string[];
    parentFileName: string | null;
  }

  const fileMetadata = new Map<string, FileMetadata>();
  let currentFile = '';

  for (const row of data) {
    const fileName = row['NOMBRE DEL ARCHIVO  '];
    const parentFile = row['ORIGEN'];
    const colada = row['COLADA'];

    if (fileName && fileName.toString().trim()) {
      currentFile = fileName.toString().trim();
      if (!fileMetadata.has(currentFile)) {
        fileMetadata.set(currentFile, {
          coladas: [],
          parentFileName: parentFile ? parentFile.toString().trim() : null,
        });
      }
    }

    if (colada && colada.toString().trim() && currentFile) {
      const coladaStr = colada.toString().trim();
      const existing = fileMetadata.get(currentFile);
      if (existing && !existing.coladas.includes(coladaStr)) {
        existing.coladas.push(coladaStr);
      }
    }
  }

  const stats: SyncStats = {
    totalInExcel: fileMetadata.size,
    newUploaded: 0,
    coladasUpdated: 0,
    alreadyExisted: 0,
    fileNotFound: 0,
    failed: 0,
    parentsLinked: 0,
    parentNotFound: 0,
    errors: [],
  };

  // PASADA 1: Subir archivos sin vincular padres
  for (const [fileName, metadata] of fileMetadata) {
    const coladaNumbers = metadata.coladas;
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

  // PASADA 2: Vincular relaciones padre-hijo
  for (const [fileName, metadata] of fileMetadata) {
    if (!metadata.parentFileName) continue;

    try {
      const childCert = await prisma.certificates.findFirst({
        where: { file_name: fileName, deleted_at: null },
      });

      if (!childCert) continue;

      const parentCert = await prisma.certificates.findFirst({
        where: { file_name: metadata.parentFileName, deleted_at: null },
      });

      if (!parentCert) {
        stats.parentNotFound++;
        stats.errors.push({
          file: fileName,
          error: `Padre no encontrado: ${metadata.parentFileName}`,
        });
        continue;
      }

      // Validar que no crea ciclo
      if (parentCert.parent_id === childCert.id) {
        stats.errors.push({
          file: fileName,
          error: `Referencia circular con ${metadata.parentFileName}`,
        });
        continue;
      }

      // Vincular padre
      await prisma.certificates.update({
        where: { id: childCert.id },
        data: { parent_id: parentCert.id },
      });

      stats.parentsLinked++;
    } catch (error) {
      stats.errors.push({
        file: fileName,
        error: `Error vinculando padre: ${error instanceof Error ? error.message : 'Error desconocido'}`,
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
