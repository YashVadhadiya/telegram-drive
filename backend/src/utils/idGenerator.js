export function generateId(prefix = '') {
  const hex = '0123456789abcdef';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  let id = '';
  for (let i = 0; i < array.length; i++) {
    id += hex[array[i] & 0x0f];
    id += hex[(array[i] >> 4) & 0x0f];
  }
  return `${prefix}${id}`;
}

export function generateToken(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let token = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  for (let i = 0; i < bytes.length; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

export function generateShareToken() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < bytes.length; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}
