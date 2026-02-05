import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

export async function GET() {
  try {
    // Obtener el último cliente ordenado por código
    const lastClient = await prisma.clients.findFirst({
      where: {
        code: {
          startsWith: 'CLI',
        },
      },
      orderBy: {
        code: 'desc',
      },
      select: {
        code: true,
      },
    });

    let nextCode = 'CLI001';

    if (lastClient && lastClient.code) {
      // Extraer el número del código (ej: "CLI001" -> "001")
      const match = lastClient.code.match(/CLI(\d+)/);
      if (match) {
        const currentNumber = parseInt(match[1], 10);
        const nextNumber = currentNumber + 1;
        // Formatear con ceros a la izquierda (3 dígitos)
        nextCode = `CLI${nextNumber.toString().padStart(3, '0')}`;
      }
    }

    return NextResponse.json({ code: nextCode });
  } catch (error) {
    return handleError(error);
  }
}
