/**
 * File chunking service.
 * Handles splitting files into chunks and reassembling them.
 * Used for files > 50MB that need to be uploaded as multiple Telegram messages.
 *
 * @module services/chunk
 */

class ChunkError extends Error {
  constructor(message, code = 'CHUNK_ERROR') {
    super(message);
    this.name = 'ChunkError';
    this.code = code;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
    };
  }
}

class ChunkService {
  /**
   * @param {Object} env - Cloudflare Workers env bindings
   * @param {string} [env.CHUNK_SIZE='52428800'] - Default chunk size in bytes (50MB)
   */
  constructor(env) {
    this.chunkSize = parseInt(env.CHUNK_SIZE || '52428800', 10);

    if (Number.isNaN(this.chunkSize) || this.chunkSize < 1024) {
      throw new ChunkError(
        'CHUNK_SIZE must be at least 1024 bytes',
        'INVALID_CHUNK_SIZE'
      );
    }
  }

  /**
   * Calculate the number of chunks for a given file size.
   *
   * @param {number} fileSize - File size in bytes
   * @returns {number} Total number of chunks
   */
  getChunkCount(fileSize) {
    if (!Number.isFinite(fileSize) || fileSize < 0) {
      throw new ChunkError('Invalid file size', 'INVALID_FILE_SIZE');
    }
    return Math.ceil(fileSize / this.chunkSize);
  }

  /**
   * Get detailed chunk information for a file.
   *
   * @param {number} fileSize - File size in bytes
   * @returns {{totalChunks: number, chunkSize: number, lastChunkSize: number}}
   */
  getChunkInfo(fileSize) {
    if (!Number.isFinite(fileSize) || fileSize < 0) {
      throw new ChunkError('Invalid file size', 'INVALID_FILE_SIZE');
    }

    const totalChunks = this.getChunkCount(fileSize);
    const lastChunkSize = totalChunks > 0
      ? fileSize - (totalChunks - 1) * this.chunkSize
      : 0;

    return {
      totalChunks,
      chunkSize: this.chunkSize,
      lastChunkSize: lastChunkSize > 0 ? lastChunkSize : 0,
    };
  }

  /**
   * Split a file (Blob/File) into chunks.
   * Each chunk is { index, data } where data is an ArrayBuffer.
   *
   * @param {Blob|File} file - File or Blob to split
   * @param {number} [chunkSize] - Chunk size in bytes (defaults to this.chunkSize)
   * @returns {Promise<Array<{index: number, data: ArrayBuffer}>>}
   */
  async splitFile(file, chunkSize) {
    if (!file || typeof file.slice !== 'function') {
      throw new ChunkError('Input must be a File or Blob', 'INVALID_INPUT');
    }

    const size = chunkSize || this.chunkSize;

    if (!Number.isFinite(size) || size < 1024) {
      throw new ChunkError('Chunk size must be at least 1024 bytes', 'INVALID_CHUNK_SIZE');
    }

    if (file.size === 0) {
      throw new ChunkError('Cannot split an empty file', 'EMPTY_FILE');
    }

    const chunks = [];
    let offset = 0;
    let index = 0;

    while (offset < file.size) {
      const end = Math.min(offset + size, file.size);
      const blobSlice = file.slice(offset, end);
      const arrayBuffer = await blobSlice.arrayBuffer();

      chunks.push({
        index,
        data: arrayBuffer,
        byteLength: arrayBuffer.byteLength,
        offset,
      });

      offset = end;
      index++;
    }

    return chunks;
  }

  /**
   * Split a Uint8Array or ArrayBuffer into chunks in-memory.
   *
   * @param {Uint8Array|ArrayBuffer} buffer - Data to split
   * @param {number} [chunkSize] - Chunk size in bytes
   * @returns {Array<{index: number, data: ArrayBuffer, byteLength: number}>}
   */
  splitBuffer(buffer, chunkSize) {
    const input = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    const size = chunkSize || this.chunkSize;

    if (input.length === 0) {
      throw new ChunkError('Cannot split an empty buffer', 'EMPTY_BUFFER');
    }

    const chunks = [];
    let offset = 0;
    let index = 0;

    while (offset < input.length) {
      const end = Math.min(offset + size, input.length);
      const chunkData = input.slice(offset, end);

      chunks.push({
        index,
        data: chunkData.buffer,
        byteLength: chunkData.byteLength,
        offset,
      });

      offset = end;
      index++;
    }

    return chunks;
  }

  /**
   * Extract a specific chunk from a file without loading the entire file.
   *
   * @param {Blob|File} file - Source file
   * @param {number} chunkIndex - Zero-based chunk index
   * @param {number} [chunkSize] - Chunk size in bytes
   * @returns {Promise<{index: number, data: ArrayBuffer, byteLength: number, offset: number}>}
   */
  async getChunk(file, chunkIndex, chunkSize) {
    if (!file || typeof file.slice !== 'function') {
      throw new ChunkError('Input must be a File or Blob', 'INVALID_INPUT');
    }

    const size = chunkSize || this.chunkSize;
    const offset = chunkIndex * size;
    const end = Math.min(offset + size, file.size);

    if (offset >= file.size) {
      throw new ChunkError(
        `Chunk index ${chunkIndex} is out of bounds`,
        'CHUNK_OUT_OF_BOUNDS'
      );
    }

    const blobSlice = file.slice(offset, end);
    const arrayBuffer = await blobSlice.arrayBuffer();

    return {
      index: chunkIndex,
      data: arrayBuffer,
      byteLength: arrayBuffer.byteLength,
      offset,
    };
  }

  /**
   * Reassemble chunks into a single ArrayBuffer.
   * Chunks are sorted by index before concatenation.
   *
   * @param {Array<{index: number, data: ArrayBuffer}>} chunks - Chunks to reassemble
   * @returns {ArrayBuffer} Reassembled file data
   */
  reassembleChunks(chunks) {
    if (!chunks || chunks.length === 0) {
      throw new ChunkError('No chunks to reassemble', 'EMPTY_CHUNKS');
    }

    const sorted = [...chunks].sort((a, b) => a.index - b.index);

    const totalSize = sorted.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of sorted) {
      const data = new Uint8Array(chunk.data);
      result.set(data, offset);
      offset += data.byteLength;
    }

    return result.buffer;
  }

  /**
   * Reassemble chunks with a known total size.
   * Validates that the combined size matches.
   *
   * @param {Array<{index: number, data: ArrayBuffer}>} chunks - Chunks to reassemble
   * @param {number} totalSize - Expected total file size
   * @returns {ArrayBuffer} Reassembled file data
   */
  async reassembleChunksWithSize(chunks, totalSize) {
    if (!chunks || chunks.length === 0) {
      throw new ChunkError('No chunks to reassemble', 'EMPTY_CHUNKS');
    }

    const sorted = [...chunks].sort((a, b) => a.index - b.index);

    const combinedSize = sorted.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);

    if (combinedSize !== totalSize) {
      throw new ChunkError(
        `Combined chunk size (${combinedSize}) does not match expected size (${totalSize})`,
        'SIZE_MISMATCH'
      );
    }

    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of sorted) {
      const data = new Uint8Array(chunk.data);
      result.set(data, offset);
      offset += data.byteLength;
    }

    return result.buffer;
  }

  /**
   * Validate that chunks cover the entire file without gaps or overlaps.
   *
   * @param {Array<{index: number, data: ArrayBuffer}>} chunks - Chunks to validate
   * @param {number} totalSize - Expected total file size
   * @param {number} chunkSize - Expected chunk size
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validateChunks(chunks, totalSize, chunkSize) {
    const errors = [];
    const size = chunkSize || this.chunkSize;

    if (!chunks || chunks.length === 0) {
      return { valid: false, errors: ['No chunks provided'] };
    }

    const expectedCount = Math.ceil(totalSize / size);
    if (chunks.length !== expectedCount) {
      errors.push(
        `Expected ${expectedCount} chunks but got ${chunks.length}`
      );
    }

    const sorted = [...chunks].sort((a, b) => a.index - b.index);
    const indices = sorted.map((c) => c.index);

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].index !== i) {
        errors.push(`Missing chunk at index ${i}`);
      }
    }

    if (sorted.length > 0) {
      const lastIndex = sorted[sorted.length - 1].index;
      if (sorted.length - 1 !== lastIndex) {
        errors.push('Chunk indices are not contiguous');
      }
    }

    const uniqueIndices = new Set(indices);
    if (uniqueIndices.size !== sorted.length) {
      errors.push('Duplicate chunk indices detected');
    }

    let computedSize = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].data.byteLength !== size) {
        errors.push(
          `Chunk ${sorted[i].index} has unexpected size: ${sorted[i].data.byteLength} (expected ${size})`
        );
      }
      computedSize += sorted[i].data.byteLength;
    }

    if (sorted.length > 0) {
      const lastChunk = sorted[sorted.length - 1];
      const expectedLastSize = totalSize - (sorted.length - 1) * size;
      computedSize += lastChunk.data.byteLength;

      if (lastChunk.data.byteLength !== expectedLastSize) {
        errors.push(
          `Last chunk has unexpected size: ${lastChunk.data.byteLength} (expected ${expectedLastSize})`
        );
      }
    }

    if (computedSize !== totalSize) {
      errors.push(
        `Total chunk size (${computedSize}) does not match file size (${totalSize})`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Merge consecutive chunks into larger blocks.
   * Useful when downloading chunks to reduce the number of reassembly operations.
   *
   * @param {Array<{index: number, data: ArrayBuffer}>} chunks - Sorted chunks
   * @param {number} [mergeCount=10] - Number of chunks to merge per block
   * @returns {Array<{startIndex: number, endIndex: number, data: ArrayBuffer}>}
   */
  mergeChunks(chunks, mergeCount = 10) {
    if (!chunks || chunks.length === 0) return [];

    const sorted = [...chunks].sort((a, b) => a.index - b.index);
    const blocks = [];

    for (let i = 0; i < sorted.length; i += mergeCount) {
      const blockChunks = sorted.slice(i, i + mergeCount);
      const totalSize = blockChunks.reduce((sum, c) => sum + c.data.byteLength, 0);
      const result = new Uint8Array(totalSize);
      let offset = 0;

      for (const chunk of blockChunks) {
        const data = new Uint8Array(chunk.data);
        result.set(data, offset);
        offset += data.byteLength;
      }

      blocks.push({
        startIndex: blockChunks[0].index,
        endIndex: blockChunks[blockChunks.length - 1].index,
        data: result.buffer,
      });
    }

    return blocks;
  }
}

/**
 * Create a ChunkService instance.
 *
 * @param {Object} env - Cloudflare Workers env bindings
 * @returns {ChunkService} Configured chunk service instance
 */
export function createChunkService(env) {
  return new ChunkService(env);
}

export { ChunkService, ChunkError };
