import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/jwt';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      username: session.username,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
    },
  });
}


