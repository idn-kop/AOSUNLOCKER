import { onRequest } from '../functions/api/[[path]].js';

const isApiRequest = (pathname) => pathname === '/api' || pathname.startsWith('/api/');

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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
