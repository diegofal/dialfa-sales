import { NextRequest } from 'next/server';
import { list, getById, getDownloadUrl, remove, createColada } from '../CertificateService';

// Mock dependencies
const mockCertFindMany = jest.fn();
const mockCertFindUnique = jest.fn();
const mockCertCount = jest.fn();
const mockCertUpdate = jest.fn();
const mockColadasFindUnique = jest.fn();
const mockColadasCreate = jest.fn();
const mockColadasFindMany = jest.fn();
const mockColadasCount = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    certificates: {
      get findMany() {
        return mockCertFindMany;
      },
      get findUnique() {
        return mockCertFindUnique;
      },
      get count() {
        return mockCertCount;
      },
      get update() {
        return mockCertUpdate;
      },
    },
    coladas: {
      get findUnique() {
        return mockColadasFindUnique;
      },
      get create() {
        return mockColadasCreate;
      },
      get findMany() {
        return mockColadasFindMany;
      },
      get count() {
        return mockColadasCount;
      },
    },
  },
  Prisma: {},
}));

jest.mock('@/lib/utils/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(1n),
}));

jest.mock('@/lib/utils/changeTracker', () => ({
  ChangeTracker: jest.fn().mockImplementation(() => ({
    trackDelete: jest.fn(),
    saveChanges: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockGetSignedUrl = jest.fn();
const mockDeleteFile = jest.fn();
jest.mock('@/lib/storage/supabase', () => ({
  getCertificateSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
  deleteCertificateFile: (...args: unknown[]) => mockDeleteFile(...args),
  uploadCertificateFile: jest.fn(),
  getFileExtension: (name: string) => name.split('.').pop() || '',
  isAllowedFileType: jest.fn().mockReturnValue(true),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/certificates', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockCert = {
  id: 1n,
  file_name: 'cert-2024.pdf',
  storage_path: 'certificates/BRIDAS/cert-2024.pdf',
  original_path: 'G:\\certs\\cert-2024.pdf',
  file_type: 'pdf',
  file_size_bytes: 1024n,
  category: 'BRIDAS',
  notes: 'Test cert',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-06-01'),
  deleted_at: null,
  certificate_coladas: [
    {
      colada: {
        id: 10n,
        colada_number: 'COL-001',
        description: 'Test colada',
        supplier: 'BestFlow',
        material_type: 'A105',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      },
    },
  ],
};

describe('list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated certificates', async () => {
    mockCertFindMany.mockResolvedValue([mockCert]);
    mockCertCount.mockResolvedValue(1);

    const result = await list({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].file_name).toBe('cert-2024.pdf');
    expect(result.data[0].coladas).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('filters by category', async () => {
    mockCertFindMany.mockResolvedValue([]);
    mockCertCount.mockResolvedValue(0);

    await list({ page: 1, limit: 10, category: 'BRIDAS' });

    expect(mockCertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'BRIDAS' }),
      })
    );
  });

  it('filters by file type', async () => {
    mockCertFindMany.mockResolvedValue([]);
    mockCertCount.mockResolvedValue(0);

    await list({ page: 1, limit: 10, fileType: 'tiff' });

    expect(mockCertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ file_type: 'tiff' }),
      })
    );
  });

  it('filters by colada number', async () => {
    mockCertFindMany.mockResolvedValue([]);
    mockCertCount.mockResolvedValue(0);

    await list({ page: 1, limit: 10, colada: 'COL-001' });

    expect(mockCertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          certificate_coladas: expect.any(Object),
        }),
      })
    );
  });
});

describe('getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns certificate with signed URL', async () => {
    mockCertFindUnique.mockResolvedValue(mockCert);
    mockGetSignedUrl.mockResolvedValue('https://signed-url.com/cert.pdf');

    const result = await getById(1n);

    expect(result).not.toBeNull();
    expect(result?.signed_url).toBe('https://signed-url.com/cert.pdf');
    expect(result?.file_name).toBe('cert-2024.pdf');
  });

  it('returns null when not found', async () => {
    mockCertFindUnique.mockResolvedValue(null);
    const result = await getById(999n);
    expect(result).toBeNull();
  });

  it('returns null when soft-deleted', async () => {
    mockCertFindUnique.mockResolvedValue({ ...mockCert, deleted_at: new Date() });
    const result = await getById(1n);
    expect(result).toBeNull();
  });
});

describe('getDownloadUrl', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns signed URL and file name', async () => {
    mockCertFindUnique.mockResolvedValue({
      storage_path: 'path/to/cert.pdf',
      file_name: 'cert.pdf',
    });
    mockGetSignedUrl.mockResolvedValue('https://download-url.com');

    const result = await getDownloadUrl(1n);

    expect(result?.signedUrl).toBe('https://download-url.com');
    expect(result?.fileName).toBe('cert.pdf');
  });

  it('returns null when certificate not found', async () => {
    mockCertFindUnique.mockResolvedValue(null);
    const result = await getDownloadUrl(999n);
    expect(result).toBeNull();
  });
});

describe('remove', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when certificate not found', async () => {
    mockCertFindUnique.mockResolvedValue(null);

    const result = await remove(999n, createMockRequest());

    expect(result.status).toBe(404);
    expect(result.error).toBe('Certificate not found');
  });

  it('soft-deletes the certificate', async () => {
    mockCertFindUnique.mockResolvedValue(mockCert);
    mockDeleteFile.mockResolvedValue(undefined);
    mockCertUpdate.mockResolvedValue({ ...mockCert, deleted_at: new Date() });

    const result = await remove(1n, createMockRequest());

    expect(result.status).toBe(200);
    expect(mockCertUpdate).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { deleted_at: expect.any(Date) },
    });
  });

  it('deletes file from storage', async () => {
    mockCertFindUnique.mockResolvedValue(mockCert);
    mockDeleteFile.mockResolvedValue(undefined);
    mockCertUpdate.mockResolvedValue({ ...mockCert, deleted_at: new Date() });

    await remove(1n, createMockRequest());

    expect(mockDeleteFile).toHaveBeenCalledWith(mockCert.storage_path);
  });

  it('continues even if storage delete fails', async () => {
    mockCertFindUnique.mockResolvedValue(mockCert);
    mockDeleteFile.mockRejectedValue(new Error('Storage error'));
    mockCertUpdate.mockResolvedValue({ ...mockCert, deleted_at: new Date() });

    const result = await remove(1n, createMockRequest());

    expect(result.status).toBe(200); // Still succeeds
  });
});

describe('createColada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when colada_number is empty', async () => {
    const result = await createColada({ colada_number: '' }, createMockRequest());
    expect(result.status).toBe(400);
    expect(result.error).toBe('Colada number is required');
  });

  it('returns 409 when colada already exists', async () => {
    mockColadasFindUnique.mockResolvedValue({ id: 1n, colada_number: 'COL-001' });

    const result = await createColada({ colada_number: 'COL-001' }, createMockRequest());

    expect(result.status).toBe(409);
    expect(result.error).toBe('Colada already exists');
  });

  it('creates colada with uppercased number', async () => {
    mockColadasFindUnique.mockResolvedValue(null);
    mockColadasCreate.mockResolvedValue({
      id: 5n,
      colada_number: 'COL-002',
      description: null,
      supplier: null,
      material_type: null,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    });

    const result = await createColada(
      { colada_number: 'col-002', supplier: 'Test' },
      createMockRequest()
    );

    expect(result.status).toBe(201);
    expect(mockColadasCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        colada_number: 'COL-002',
        supplier: 'Test',
      }),
    });
  });
});
