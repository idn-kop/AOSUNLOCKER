const isAdminPath = (pathname) =>
  pathname === '/admin' ||
  pathname === '/admin/' ||
  pathname === '/admin.html' ||
  pathname.startsWith('/api/admin');

const buildCsp = () =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data: https:",
    "connect-src 'self' https://aosunlocker.com",
    'upgrade-insecure-requests',
  ].join('; ');

export async function onRequest(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);
  const pathname = new URL(context.request.url).pathname;

  headers.set('Content-Security-Policy', buildCsp());
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000');

  if (isAdminPath(pathname)) {
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
