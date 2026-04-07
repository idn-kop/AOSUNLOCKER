import { onRequest } from '../functions/api/[[path]].js';

const isApiRequest = (pathname) => pathname === '/api' || pathname.startsWith('/api/');
const CANONICAL_HOST = 'aosunlocker.com';
const LEGACY_HOSTS = new Set(['www.aosunlocker.com']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (LEGACY_HOSTS.has(url.hostname)) {
      url.hostname = CANONICAL_HOST;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }

    if (isApiRequest(url.pathname)) {
      return onRequest({
        request,
        env,
        ctx,
        data: {},
        waitUntil: ctx.waitUntil.bind(ctx),
        next: async (input = request, init) => env.ASSETS.fetch(input, init),
      });
    }

    return env.ASSETS.fetch(request);
  },
};
