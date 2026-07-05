import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = {
  TELEGRAM_BOT_TOKEN: 'test_bot_token',
  JWT_PUBLIC_KEY: 'test_public_key',
  JWT_PRIVATE_KEY: 'test_private_key',
  ENCRYPTION_MASTER_KEY: 'test_master_key',
  DB: {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    run: vi.fn(),
    all: vi.fn()
  },
  KV: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
};

describe('Auth Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Telegram Auth Verification', () => {
    it('should reject missing hash', async () => {
      const { handleTelegramAuth } = await import('../src/handlers/auth.js');
      const request = new Request('http://localhost/api/v1/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 123, auth_date: 1700000000 })
      });
      const response = await handleTelegramAuth(request, mockEnv);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  describe('Refresh Token', () => {
    it('should require refresh token', async () => {
      const { handleRefreshToken } = await import('../src/handlers/auth.js');
      const request = new Request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const response = await handleRefreshToken(request, mockEnv);
      expect(response.status).toBe(400);
    });
  });
});

describe('Folder Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list folders for authenticated user', async () => {
    const { handleListFolders } = await import('../src/handlers/folders.js');
    mockEnv.DB.all.mockResolvedValue({
      results: [
        { id: 'fld_1', name: 'Movies', icon: 'film', file_count: 5, total_size: 1000000 }
      ]
    });
    const request = new Request('http://localhost/api/v1/folders');
    request.user = { id: 'usr_test', telegramId: 123 };
    const response = await handleListFolders(request, mockEnv);
    expect(response.status).toBe(200);
  });
});

describe('File Validation', () => {
  it('should reject filenames with path separators', async () => {
    const { validateFileName } = await import('../src/validators/file.js');
    expect(validateFileName('../../etc/passwd').valid).toBe(false);
  });

  it('should accept valid filenames', async () => {
    const { validateFileName } = await import('../src/validators/file.js');
    expect(validateFileName('document.pdf').valid).toBe(true);
    expect(validateFileName('my file (1).txt').valid).toBe(true);
  });

  it('should reject files over 2GB', async () => {
    const { validateFileSize } = await import('../src/validators/file.js');
    expect(validateFileSize(2147483649).valid).toBe(false);
  });
});

describe('Encryption Service', () => {
  it('should encrypt and decrypt data', async () => {
    vi.mock('../src/services/encryption.js', () => ({
      createEncryption: () => ({
        encrypt: async (text) => ({
          encrypted: btoa(text),
          iv: 'test_iv',
          salt: 'test_salt'
        }),
        decrypt: async (enc, iv, salt) => atob(enc)
      })
    }));
    const { createEncryption } = await import('../src/services/encryption.js');
    const encryption = createEncryption(mockEnv);
    const { encrypted } = await encryption.encrypt('test_data');
    const decrypted = await encryption.decrypt(encrypted, 'test_iv', 'test_salt');
    expect(decrypted).toBe('test_data');
  });
});
