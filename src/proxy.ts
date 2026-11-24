import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const secretKey = new TextEncoder().encode(JWT_SECRET);

async function verifyToken(token: string): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return { sub: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;

  const protectedPaths = ['/dashboard', '/transactions', '/add-transaction', '/import', '/monthly', '/budgets', '/income', '/analytics', '/recurring', '/settings'];
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  const authPaths = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password'];
  const isAuthPath = authPaths.some(path => request.nextUrl.pathname.startsWith(path));

  let user = null;
  if (accessToken) {
    user = await verifyToken(accessToken);
  }

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
};