import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';
import { z } from 'zod';

const saveDraftSchema = z.object({
  draftData: z.record(z.string(), z.number()), // { "articleId": newPrice }
});

// GET: Obtener borrador del usuario actual
export async function GET(request: NextRequest) {
  try {
    const { authorized, error, user } = requireAdmin(request);
    if (!authorized) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user?.userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    const draft = await prisma.price_import_drafts.findUnique({
      where: { user_id: user.userId },
    });

    if (!draft) {
      return NextResponse.json({ draft: null });
    }

    return NextResponse.json({
      draft: {
        id: Number(draft.id),
        draftData: draft.draft_data,
        articleCount: draft.article_count,
        createdAt: draft.created_at.toISOString(),
        updatedAt: draft.updated_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft' },
      { status: 500 }
    );
  }
}

// POST: Guardar/Actualizar borrador
export async function POST(request: NextRequest) {
  try {
    const { authorized, error, user } = requireAdmin(request);
    if (!authorized) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user?.userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const validated = saveDraftSchema.parse(body);
    
    const articleCount = Object.keys(validated.draftData).length;

    // Upsert: crea si no existe, actualiza si existe
    const draft = await prisma.price_import_drafts.upsert({
      where: { user_id: user.userId },
      create: {
        user_id: user.userId,
        draft_data: validated.draftData,
        article_count: articleCount,
      },
      update: {
        draft_data: validated.draftData,
        article_count: articleCount,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      draftId: Number(draft.id),
      articleCount,
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar borrador
export async function DELETE(request: NextRequest) {
  try {
    const { authorized, error, user } = requireAdmin(request);
    if (!authorized) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user?.userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    await prisma.price_import_drafts.delete({
      where: { user_id: user.userId },
    });

    return NextResponse.json({ success: true });
  } catch {
    // Si no existe el borrador, no es un error
    return NextResponse.json({ success: true });
  }
}
