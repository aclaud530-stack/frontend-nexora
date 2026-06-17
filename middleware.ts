import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const cspHeader = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https:`,
    `connect-src 'self' https://banckend-nexora-production.up.railway.app wss://banckend-nexora-production.up.railway.app https://auth.deriv.com https://oauth.deriv.com https://api.derivws.com wss://api.derivws.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://auth.deriv.com`,
    `object-src 'none'`,
  ].join('; ')

  response.headers.set('Content-Security-Policy', cspHeader)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  const pathname = request.nextUrl.pathname
  const blockedPaths = ['/.env', '/.git', '/wp-admin', '/wp-login', '/xmlrpc.php', '/phpmyadmin', '/.htaccess']
  if (blockedPaths.some(p => pathname.toLowerCase().startsWith(p))) {
    return new NextResponse('Not Found', { status: 404 })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
