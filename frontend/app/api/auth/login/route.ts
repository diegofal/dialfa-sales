import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as AuthService from '@/lib/services/AuthService';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const result = await AuthService.login(username, password, request);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    return handleError(error);
  }
}
