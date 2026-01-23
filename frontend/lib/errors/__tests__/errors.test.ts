import { AppError } from '../AppError';
import { handleError } from '../handler';

describe('AppError', () => {
  it('creates error with message and statusCode', () => {
    const error = new AppError('Something failed', 500);
    expect(error.message).toBe('Something failed');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('AppError');
    expect(error.code).toBeUndefined();
  });

  it('creates error with optional code', () => {
    const error = new AppError('Conflict', 409, 'DUPLICATE');
    expect(error.code).toBe('DUPLICATE');
  });

  it('is an instance of Error', () => {
    const error = new AppError('test', 400);
    expect(error).toBeInstanceOf(Error);
  });

  describe('static factory methods', () => {
    it('badRequest creates 400 error', () => {
      const error = AppError.badRequest('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
    });

    it('badRequest with code', () => {
      const error = AppError.badRequest('Bad', 'INVALID_FORMAT');
      expect(error.code).toBe('INVALID_FORMAT');
    });

    it('unauthorized creates 401 error with default message', () => {
      const error = AppError.unauthorized();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('No autorizado');
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('unauthorized with custom message', () => {
      const error = AppError.unauthorized('Token expired');
      expect(error.message).toBe('Token expired');
    });

    it('forbidden creates 403 error', () => {
      const error = AppError.forbidden();
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Acceso denegado');
      expect(error.code).toBe('FORBIDDEN');
    });

    it('notFound creates 404 error', () => {
      const error = AppError.notFound();
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Recurso no encontrado');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('notFound with custom message', () => {
      const error = AppError.notFound('Artículo no encontrado');
      expect(error.message).toBe('Artículo no encontrado');
    });

    it('conflict creates 409 error', () => {
      const error = AppError.conflict('Ya existe', 'DUPLICATE');
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Ya existe');
      expect(error.code).toBe('DUPLICATE');
    });

    it('internal creates 500 error', () => {
      const error = AppError.internal();
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Error interno del servidor');
      expect(error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('toResponse', () => {
    it('returns NextResponse with correct status and body', async () => {
      const error = AppError.badRequest('Invalid data', 'VALIDATION');
      const response = error.toResponse();

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({ error: 'Invalid data', code: 'VALIDATION' });
    });

    it('omits code when not set', async () => {
      const error = new AppError('Something failed', 500);
      const response = error.toResponse();
      const body = await response.json();
      expect(body.code).toBeUndefined();
    });
  });
});

describe('handleError', () => {
  it('handles AppError instances', async () => {
    const error = AppError.notFound('No existe');
    const response = handleError(error);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('No existe');
    expect(body.code).toBe('NOT_FOUND');
  });

  it('handles ZodError with issues', async () => {
    // Create a mock ZodError-like object
    const { z } = await import('zod');
    const schema = z.object({ name: z.string().min(1, 'Nombre requerido') });
    const result = schema.safeParse({ name: '' });

    if (!result.success) {
      const response = handleError(result.error);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toContain('Nombre requerido');
    }
  });

  it('handles Prisma P2002 unique constraint', async () => {
    const error = { code: 'P2002', meta: { target: ['code'] } };
    const response = handleError(error);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe('UNIQUE_CONSTRAINT');
    expect(body.error).toContain('code');
  });

  it('handles Prisma P2002 without meta', async () => {
    const error = { code: 'P2002' };
    const response = handleError(error);

    const body = await response.json();
    expect(body.error).toContain('campo');
  });

  it('handles Prisma P2025 not found', async () => {
    const error = { code: 'P2025' };
    const response = handleError(error);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  it('handles Prisma P2003 foreign key constraint', async () => {
    const error = { code: 'P2003' };
    const response = handleError(error);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe('FOREIGN_KEY_CONSTRAINT');
  });

  it('handles generic Error instances', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const error = new Error('Something broke');
    const response = handleError(error);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Something broke');
    expect(body.code).toBe('INTERNAL_ERROR');
    consoleSpy.mockRestore();
  });

  it('handles non-Error unknown values', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const response = handleError('string error');

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Error interno del servidor');
    consoleSpy.mockRestore();
  });

  it('handles null error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const response = handleError(null);

    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
