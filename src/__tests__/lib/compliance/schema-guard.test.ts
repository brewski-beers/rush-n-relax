import { describe, it, test, expect } from 'vitest';
import {
  validateSchemaType,
  isAllowedSchemaType,
  ComplianceError,
} from '@/lib/compliance/schema-guard';

describe('validateSchemaType', () => {
  const forbidden = [
    'Pharmacy',
    'MedicalBusiness',
    'MedicalOrganization',
    'Hospital',
    'Physician',
    'DrugLegalStatus',
  ];

  test.each(forbidden)(
    'throws ComplianceError for forbidden type: %s',
    type => {
      expect(() => validateSchemaType(type)).toThrow(ComplianceError);
      expect(() => validateSchemaType(type)).toThrow(type);
    }
  );

  const allowed = [
    'LocalBusiness',
    'Store',
    'Organization',
    'Product',
    'FAQPage',
    'BreadcrumbList',
    'ItemList',
    'WebSite',
    'Offer',
  ];

  test.each(allowed)('does not throw for allowed type: %s', type => {
    expect(() => validateSchemaType(type)).not.toThrow();
  });

  it('does not throw for unknown type (not in forbidden list)', () => {
    expect(() => validateSchemaType('SomeUnknownType')).not.toThrow();
  });
});

describe('isAllowedSchemaType', () => {
  it('returns true for explicitly allowed types', () => {
    expect(isAllowedSchemaType('LocalBusiness')).toBe(true);
    expect(isAllowedSchemaType('Product')).toBe(true);
    expect(isAllowedSchemaType('BreadcrumbList')).toBe(true);
  });

  it('returns false for unknown types', () => {
    expect(isAllowedSchemaType('SomeUnknownType')).toBe(false);
  });

  it('returns false for forbidden types', () => {
    expect(isAllowedSchemaType('Pharmacy')).toBe(false);
    expect(isAllowedSchemaType('MedicalBusiness')).toBe(false);
  });
});

describe('ComplianceError', () => {
  it('has name ComplianceError', () => {
    const err = new ComplianceError('test');
    expect(err.name).toBe('ComplianceError');
    expect(err.message).toBe('test');
    expect(err).toBeInstanceOf(Error);
  });
});
