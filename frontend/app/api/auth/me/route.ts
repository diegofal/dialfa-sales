import { NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as AuthService from '@/lib/services/AuthService';

export async function GET() {
  try {
    const user = await AuthService.validateSession();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return handleError(error);
  }
}
