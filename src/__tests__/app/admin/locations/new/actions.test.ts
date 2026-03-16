import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  upsertLocationMock,
  getLocationBySlugMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  upsertLocationMock: vi.fn().mockResolvedValue('oak-ridge'),
  getLocationBySlugMock: vi.fn().mockResolvedValue(null),
  redirectMock: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  upsertLocation: upsertLocationMock,
  getLocationBySlug: getLocationBySlugMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { createLocation } from '@/app/(admin)/admin/locations/new/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    slug: 'oak-ridge',
    name: 'Oak Ridge',
    address: '123 Oak Ave',
    city: 'Oak Ridge',
    state: 'TN',
    zip: '37830',
    phone: '865-555-0100',
    openHour: '9',
    openMinute: '00',
    openMeridiem: 'AM',
    closeHour: '9',
    closeMinute: '00',
    closeMeridiem: 'PM',
    description: 'Our Oak Ridge location',
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.set(key, value);
  }
  return fd;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createLocation server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unsupported state', () => {
    it('returns an invalid-state error', async () => {
      stubAuthorisedActor();

      const result = await createLocation(null, makeFormData({ state: 'CA' }));

      expect(result).toEqual({
        error: 'State must be selected from the approved list.',
      });
      expect(upsertLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid hour option', () => {
    it('returns an invalid-hours error for out-of-range hour', async () => {
      stubAuthorisedActor();

      const result = await createLocation(
        null,
        makeFormData({ openHour: '13' })
      );

      expect(result).toEqual({
        error: 'Hours must be selected from approved time options.',
      });
      expect(upsertLocationMock).not.toHaveBeenCalled();
    });

    it('returns an invalid-hours error for invalid minute option', async () => {
      stubAuthorisedActor();

      const result = await createLocation(
        null,
        makeFormData({ openMinute: '07' })
      );

      expect(result).toEqual({
        error: 'Hours must be selected from approved time options.',
      });
      expect(upsertLocationMock).not.toHaveBeenCalled();
    });

    it('returns an invalid-hours error for invalid meridiem option', async () => {
      stubAuthorisedActor();

      const result = await createLocation(
        null,
        makeFormData({ openMeridiem: 'XX' })
      );

      expect(result).toEqual({
        error: 'Hours must be selected from approved time options.',
      });
      expect(upsertLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing required fields', () => {
    it('returns a required-fields error when name is absent', async () => {
      stubAuthorisedActor();

      const result = await createLocation(null, makeFormData({ name: '' }));

      expect(result).toEqual({ error: 'All fields are required.' });
      expect(upsertLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given a slug that already exists', () => {
    it('returns a slug-uniqueness error', async () => {
      stubAuthorisedActor();
      getLocationBySlugMock.mockResolvedValue({
        id: 'oak-ridge',
        slug: 'oak-ridge',
        name: 'Oak Ridge',
      });

      const result = await createLocation(null, makeFormData());

      expect(result).toEqual({
        error: 'A location with slug "oak-ridge" already exists.',
      });
      expect(upsertLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given a valid payload', () => {
    it('passes buildHoursRange output to upsertLocation', async () => {
      stubAuthorisedActor();
      getLocationBySlugMock.mockResolvedValue(null);
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(createLocation(null, makeFormData())).rejects.toThrow(
        'NEXT_REDIRECT'
      );

      expect(upsertLocationMock).toHaveBeenCalledOnce();
      const [payload] = upsertLocationMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      // buildHoursRange formats as "openTime - closeTime"
      expect(payload.hours).toBe('9:00 AM - 9:00 PM');
      expect(payload.slug).toBe('oak-ridge');
      expect(payload.state).toBe('TN');
    });

    it('redirects to /admin/locations', async () => {
      stubAuthorisedActor();
      getLocationBySlugMock.mockResolvedValue(null);
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(createLocation(null, makeFormData())).rejects.toThrow(
        'NEXT_REDIRECT'
      );

      expect(redirectMock).toHaveBeenCalledWith('/admin/locations');
    });
  });
});
