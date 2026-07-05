/**
 * Folder validation functions.
 *
 * @module validators/folder
 */

const NAME_REGEX = /^[a-zA-Z0-9 _\-.]+$/;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate folder creation data.
 *
 * @param {Object} data - Folder creation payload
 * @param {*} data.name - Folder name (required)
 * @param {*} [data.icon] - Icon identifier (optional)
 * @param {*} [data.color] - Hex color string (optional)
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateCreateFolder(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  if (data.name === undefined || data.name === null) {
    errors.push('name is required');
  } else if (typeof data.name !== 'string') {
    errors.push('name must be a string');
  } else {
    const trimmed = data.name.trim();
    if (trimmed.length < 1) {
      errors.push('name must not be empty');
    } else if (trimmed.length > 100) {
      errors.push('name must be at most 100 characters');
    } else if (!NAME_REGEX.test(trimmed)) {
      errors.push('name may only contain letters, numbers, spaces, hyphens, underscores, and dots');
    }
  }

  if (data.icon !== undefined && data.icon !== null) {
    if (typeof data.icon !== 'string') {
      errors.push('icon must be a string');
    } else if (data.icon.length > 50) {
      errors.push('icon must be at most 50 characters');
    }
  }

  if (data.color !== undefined && data.color !== null) {
    if (typeof data.color !== 'string') {
      errors.push('color must be a string');
    } else if (!HEX_COLOR_REGEX.test(data.color)) {
      errors.push('color must be a valid hex color (e.g. #4A90D9)');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate folder update data.
 *
 * @param {Object} data - Folder update payload
 * @param {*} [data.name] - Folder name (optional)
 * @param {*} [data.icon] - Icon identifier (optional)
 * @param {*} [data.color] - Hex color string (optional)
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateUpdateFolder(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  if (Object.keys(data).length === 0) {
    return { valid: false, errors: ['At least one field must be provided'] };
  }

  const createValidation = validateCreateFolder({
    name: data.name !== undefined ? data.name : 'valid-placeholder',
    icon: data.icon,
    color: data.color,
  });

  createValidation.errors = createValidation.errors.filter((e) => !e.startsWith('name'));

  if (data.name !== undefined) {
    const nameValidation = validateCreateFolder({ name: data.name });
    createValidation.errors.push(
      ...nameValidation.errors.filter((e) => e.startsWith('name'))
    );
  }

  return { valid: createValidation.errors.length === 0, errors: createValidation.errors };
}
