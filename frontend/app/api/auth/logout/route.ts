import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth/jwt';

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ message: 'Logged out successfully' });
}



