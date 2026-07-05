import { badRequest } from '../utils/response.js';

export function validateMiddleware(schema) {
  return async (request) => {
    if (!schema || typeof schema !== 'object') return;

    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push({ field, message: `${field} must be a string` });
        continue;
      }

      if (rules.type === 'number') {
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push({ field, message: `${field} must be a number` });
          continue;
        }
      }

      if (rules.type === 'boolean' && typeof value !== 'boolean') {
        errors.push({ field, message: `${field} must be a boolean` });
        continue;
      }

      if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push({ field, message: `${field} must be an array` });
        continue;
      }

      if (rules.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        errors.push({ field, message: `${field} must be an object` });
        continue;
      }

      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
        }
        if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
          errors.push({ field, message: `${field} format is invalid` });
        }
      }

      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push({ field, message: `${field} must be at least ${rules.min}` });
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push({ field, message: `${field} must be at most ${rules.max}` });
        }
      }

      if (Array.isArray(value) && rules.items) {
        for (let i = 0; i < value.length; i++) {
          if (rules.items.type === 'string' && typeof value[i] !== 'string') {
            errors.push({ field: `${field}[${i}]`, message: `must be a string` });
          }
        }
      }

      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
      }
    }

    if (errors.length > 0) {
      return badRequest('Validation failed', errors);
    }

    request.validBody = body;
  };
}
