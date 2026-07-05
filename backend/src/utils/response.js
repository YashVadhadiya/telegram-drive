export function json(data, status = 200, meta = null) {
  const body = {
    success: status >= 200 && status < 300,
    data: data ?? null,
    meta: meta ?? null,
    error: null,
  };
  if (status >= 400) {
    body.error = data;
    body.data = null;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export function success(data, meta) {
  return json(data, 200, meta);
}

export function created(data) {
  return json(data, 201);
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function badRequest(message, details = null) {
  return json({ code: 'VALIDATION_ERROR', message, details }, 400);
}

export function unauthorized(message = 'Authentication required') {
  return json({ code: 'UNAUTHORIZED', message }, 401);
}

export function forbidden(message = 'Access denied') {
  return json({ code: 'FORBIDDEN', message }, 403);
}

export function notFound(message = 'Resource not found') {
  return json({ code: 'NOT_FOUND', message }, 404);
}

export function tooManyRequests(message = 'Too many requests') {
  return json({ code: 'RATE_LIMITED', message }, 429);
}

export function serverError(err = null) {
  const message = err?.message ?? 'Internal server error';
  return json({ code: 'INTERNAL_ERROR', message }, 500);
}
