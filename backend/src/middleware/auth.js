import { unauthorized } from '../utils/response.js';

export async function authMiddleware(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  const publicPaths = ['/api/v1/auth/telegram', '/api/v1/auth/refresh', '/api/v1/share/'];
  if (publicPaths.some(p => path.startsWith(p))) {
    return;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyJWT(token, env);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return unauthorized('Token has expired');
    }

    request.user = {
      id: payload.sub,
      telegramId: payload.telegramId,
      username: payload.username,
    };
  } catch (err) {
    return unauthorized(err.message || 'Invalid token');
  }
}

async function verifyJWT(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(base64UrlDecode(headerB64));
  const payload = JSON.parse(base64UrlDecode(payloadB64));

  if (header.alg !== 'RS256') {
    throw new Error('Unsupported algorithm');
  }

  const key = await importPublicKey(env.JWT_PUBLIC_KEY);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = base64UrlToArrayBuffer(signatureB64);

  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    key,
    sig,
    data
  );

  if (!valid) {
    throw new Error('Invalid signature');
  }

  return payload;
}

async function importPublicKey(pem) {
  const pemHeader = '-----BEGIN PUBLIC KEY-----';
  const pemFooter = '-----END PUBLIC KEY-----';
  const pemContents = pem.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'spki',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['verify']
  );
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

function base64UrlToArrayBuffer(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
