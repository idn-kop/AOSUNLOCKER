import { onRequest } from '../functions/api/[[path]].js';

const isApiRequest = (pathname) => pathname === '/api' || pathname.startsWith('/api/');
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

const withSecurityHeaders = (response, pathname) => {
  const headers = new Headers(response.headers);

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
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    let response;

    if (isApiRequest(url.pathname)) {
      response = await onRequest({
        request,
        env,
        ctx,
        data: {},
        waitUntil: ctx.waitUntil.bind(ctx),
        next: async (input = request, init) => env.ASSETS.fetch(input, init),
      });
    } else {
      response = await env.ASSETS.fetch(request);
    }

    return withSecurityHeaders(response, pathname);
  },
};
