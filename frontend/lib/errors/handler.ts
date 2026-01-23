import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './AppError';

export function handleError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return error.toResponse();
  }

  if (error instanceof ZodError) {
    const messages = error.issues.map((e: { message: string }) => e.message).join(', ');
    return NextResponse.json(
      { error: 'Datos inválidos', details: messages, code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  // Prisma known request errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: { target?: string[] } };
    switch (prismaError.code) {
      case 'P2002': {
        const fields = prismaError.meta?.target?.join(', ') || 'campo';
        return NextResponse.json(
          { error: `Ya existe un registro con ese ${fields}`, code: 'UNIQUE_CONSTRAINT' },
          { status: 409 }
        );
      }
      case 'P2025':
        return NextResponse.json(
          { error: 'Registro no encontrado', code: 'NOT_FOUND' },
          { status: 404 }
        );
      case 'P2003':
        return NextResponse.json(
          {
            error: 'No se puede eliminar: existen registros relacionados',
            code: 'FOREIGN_KEY_CONSTRAINT',
          },
          { status: 409 }
        );
    }
  }

  // Generic error
  const message = error instanceof Error ? error.message : 'Error interno del servidor';
  console.error('Unhandled error:', error);
  return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 });
}
