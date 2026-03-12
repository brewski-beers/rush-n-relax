import { allowedSchemaTypes, forbiddenSchemaTypes } from './config';

export class ComplianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComplianceError';
  }
}

/**
 * Throws ComplianceError if the schema @type is forbidden.
 * Call before building any structured data object.
 */
export function validateSchemaType(type: string): void {
  if ((forbiddenSchemaTypes as readonly string[]).includes(type)) {
    throw new ComplianceError(
      `Schema type '${type}' is forbidden for cannabis/HDC businesses. ` +
        `Forbidden types: ${forbiddenSchemaTypes.join(', ')}`
    );
  }
}

/** Returns true if the type is explicitly in the allowed list. */
export function isAllowedSchemaType(type: string): boolean {
  return (allowedSchemaTypes as readonly string[]).includes(type);
}
