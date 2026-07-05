class MtProtoError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'MtProtoError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

class MtProtoService {
  constructor(env) {
    this.token = env.TELEGRAM_BOT_TOKEN;
    this.apiBase = `https://api.telegram.org/bot${this.token}`;
    this.fileBase = `https://api.telegram.org/file/bot${this.token}`;
    this.env = env;
  }

  async _request(method, params = {}) {
    const url = `${this.apiBase}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.ok) {
      throw new MtProtoError(data.error_code || 0, data.description || 'Unknown Telegram error');
    }
    return data.result;
  }

  async _requestMultipart(method, formData) {
    const url = `${this.apiBase}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (!data.ok) {
      throw new MtProtoError(data.error_code || 0, data.description || 'Unknown Telegram error');
    }
    return data.result;
  }

  async _getFile(fileId) {
    return this._request('getFile', { file_id: fileId });
  }

  async _downloadFileByPath(filePath) {
    const downloadUrl = `${this.fileBase}/${filePath}`;
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new MtProtoError(response.status, `Failed to download file: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }

  async sendChunk(chatId, chunkData, chunkIndex, totalChunks, fileName) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('document', new Blob([chunkData]), `${fileName}.part${chunkIndex + 1}`);
    formData.append('disable_notification', 'true');
    const result = await this._requestMultipart('sendDocument', formData);
    return {
      messageId: result.message_id,
      fileId: result.document?.file_id || null,
    };
  }

  async uploadLargeFile(chatId, chunks, fileName) {
    const totalChunks = chunks.length;
    const messageIds = [];

    for (let i = 0; i < totalChunks; i++) {
      const result = await this.sendChunk(chatId, chunks[i], i, totalChunks, fileName);
      messageIds.push(result.messageId);
    }

    return { messageIds };
  }

  async downloadLargeFile(chatId, messageIds) {
    const chunks = [];

    for (const messageId of messageIds) {
      const messages = await this._request('getMessages', {
        chat_id: Number(chatId),
        message_ids: [messageId],
      });

      if (!messages || messages.length === 0) {
        throw new MtProtoError(404, `Message ${messageId} not found`);
      }

      const msg = messages[0];
      if (!msg.document) {
        throw new MtProtoError(400, `Message ${messageId} does not contain a document`);
      }

      const fileId = msg.document.file_id;
      const fileInfo = await this._getFile(fileId);

      if (!fileInfo.file_path) {
        throw new MtProtoError(0, 'File path not available for download');
      }

      const chunkBuffer = await this._downloadFileByPath(fileInfo.file_path);
      chunks.push(chunkBuffer);
    }

    const totalLength = chunks.reduce((acc, buf) => acc + buf.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of chunks) {
      combined.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    return combined.buffer;
  }

  async sendAsDocument(userId, sessionString, chatId, fileBuffer, fileName, options = {}) {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('document', new Blob([fileBuffer], { type: options.mimeType || 'application/octet-stream' }), fileName);
    formData.append('disable_notification', 'true');
    const result = await this._requestMultipart('sendDocument', formData);
    return {
      messageId: result.message_id,
      chatId: Number(chatId),
      fileReference: result.document?.file_id || null,
    };
  }

  async uploadFile(userId, sessionString, chatId, fileBuffer, fileName, options = {}) {
    return this.sendAsDocument(userId, sessionString, chatId, fileBuffer, fileName, options);
  }

  async downloadFile(userId, sessionString, chatId, messageId, options = {}) {
    const messages = await this._request('getMessages', {
      chat_id: Number(chatId),
      message_ids: [messageId],
    });

    if (!messages || messages.length === 0) {
      throw new MtProtoError(404, 'Message not found');
    }

    const msg = messages[0];
    if (!msg.document) {
      throw new MtProtoError(400, 'Message does not contain a file');
    }

    const doc = msg.document;
    const fileInfo = await this._getFile(doc.file_id);

    if (!fileInfo.file_path) {
      throw new MtProtoError(0, 'File path not available for download');
    }

    const buffer = await this._downloadFileByPath(fileInfo.file_path);

    return {
      buffer,
      media: {
        id: doc.file_id,
        size: fileInfo.file_size,
        mimeType: doc.mime_type,
        fileName: doc.file_name || null,
        dcId: null,
      },
    };
  }

  async getMessages(userId, sessionString, chatId, messageIds, options = {}) {
    const messages = await this._request('getMessages', {
      chat_id: Number(chatId),
      message_ids: messageIds,
    });

    return (messages || []).map((msg) => ({
      id: msg.message_id,
      date: msg.date,
      message: msg.caption || '',
      hasMedia: !!msg.document,
      media: msg.document
        ? {
            document: {
              id: msg.document.file_id,
              size: msg.document.file_size,
              mimeType: msg.document.mime_type,
              dcId: null,
              accessHash: null,
              fileReference: null,
            },
            photo: null,
          }
        : null,
    }));
  }

  async sendMessage(userId, sessionString, chatId, text, options = {}) {
    const result = await this._request('sendMessage', {
      chat_id: Number(chatId),
      text,
      parse_mode: options.parseMode || 'HTML',
    });

    return {
      messageId: result.message_id,
      chatId: Number(chatId),
      date: result.date,
    };
  }

  async deleteMessages(userId, sessionString, chatId, messageIds) {
    for (const messageId of messageIds) {
      try {
        await this._request('deleteMessage', {
          chat_id: Number(chatId),
          message_id: messageId,
        });
      } catch {
      }
    }
  }

  async pinMessage(userId, sessionString, chatId, messageId) {
    return this._request('pinChatMessage', {
      chat_id: Number(chatId),
      message_id: messageId,
    });
  }

  async unpinMessage(userId, sessionString, chatId, messageId) {
    if (messageId) {
      return this._request('unpinChatMessage', {
        chat_id: Number(chatId),
        message_id: messageId,
      });
    }
    return this._request('unpinAllChatMessages', {
      chat_id: Number(chatId),
    });
  }

  async getMe(userId, sessionString) {
    const me = await this._request('getMe');
    return {
      id: me.id.toString(),
      username: me.username || null,
      phone: null,
      firstName: me.first_name || null,
      lastName: me.last_name || null,
      isSelf: false,
      bot: me.is_bot,
    };
  }

  async resolvePeer(userId, sessionString, chatId) {
    return { chatId: Number(chatId) };
  }

  async disconnect(userId) {
    return true;
  }

  async disconnectAll() {
    return 0;
  }

  isConnected(userId) {
    return false;
  }

  getConnectedCount() {
    return 0;
  }

  _parseChatId(chatId) {
    return Number(chatId);
  }

  _getFileNameFromDocument(document) {
    return document.file_name || null;
  }
}

export function createMtProto(env) {
  return new MtProtoService(env);
}

export { MtProtoService, MtProtoError };
