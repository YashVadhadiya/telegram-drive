export function createRouter() {
  const routes = [];

  function addRoute(method, pattern, ...handlers) {
    const paramNames = [];
    let regexStr = pattern
      .replace(/\*/g, '.*?')
      .replace(/:([a-zA-Z_]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });
    const regex = new RegExp(`^${regexStr}$`);
    routes.push({ method, regex, paramNames, handlers });
  }

  const router = {
    get(pattern, ...h) { addRoute('GET', pattern, ...h); return router; },
    post(pattern, ...h) { addRoute('POST', pattern, ...h); return router; },
    put(pattern, ...h) { addRoute('PUT', pattern, ...h); return router; },
    patch(pattern, ...h) { addRoute('PATCH', pattern, ...h); return router; },
    delete(pattern, ...h) { addRoute('DELETE', pattern, ...h); return router; },
    all(pattern, ...h) { addRoute('ALL', pattern, ...h); return router; },

    async handle(request, env, ctx) {
      const url = new URL(request.url);
      const method = request.method.toUpperCase();

      for (const route of routes) {
        if (route.method !== 'ALL' && route.method !== method) continue;
        const match = url.pathname.match(route.regex);
        if (!match) continue;

        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        request.params = params;
        request.query = Object.fromEntries(url.searchParams);

        for (const handler of route.handlers) {
          const result = await handler(request, env, ctx);
          if (result !== undefined) return result;
        }
      }
    },
  };

  return router;
}
