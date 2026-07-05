import { success, noContent, badRequest, serverError } from '../utils/response.js';
import { createStorage } from '../services/storage.js';

export async function startSessionHandler(request, env, ctx) {
  try {
    const body = await request.json();

    if (!body.phone) {
      return badRequest('Phone number is required (international format, e.g. +1234567890)');
    }

    const phone = String(body.phone).replace(/[^0-9+]/g, '');
    if (phone.length < 8 || phone.length > 20) {
      return badRequest('Invalid phone number format');
    }

    const storage = createStorage(env);
    await storage.storeTelegramSession(
      request.user.id,
      '',
      '',
      '',
      phone
    );

    return success({
      phoneCodeHash: 'placeholder',
      phone,
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function verifySessionHandler(request, env, ctx) {
  try {
    const body = await request.json();

    if (!body.phone || !body.code || !body.phone_code_hash) {
      return badRequest('phone, code, and phone_code_hash are required');
    }

    const storage = createStorage(env);
    await storage.storeTelegramSession(
      request.user.id,
      'connected',
      '',
      '',
      body.phone
    );

    return success({
      message: 'Telegram session connected successfully',
      phone: body.phone,
      user: {
        id: request.user.id,
        username: null,
        phone: body.phone,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function deleteSessionHandler(request, env, ctx) {
  try {
    const storage = createStorage(env);
    await storage.deleteTelegramSession(request.user.id);
    return noContent();
  } catch (err) {
    return serverError(err);
  }
}
