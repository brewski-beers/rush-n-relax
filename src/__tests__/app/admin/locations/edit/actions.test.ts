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
  getLocationBySlugMock: vi.fn(),
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

import { updateLocation } from '@/app/(admin)/admin/locations/[slug]/edit/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function stubExistingLocation(overrides: Record<string, unknown> = {}) {
  getLocationBySlugMock.mockResolvedValue({
    id: 'oak-ridge',
    slug: 'oak-ridge',
    name: 'Oak Ridge',
    address: '123 Oak Ave',
    city: 'Oak Ridge',
    state: 'TN',
    zip: '37830',
    phone: '865-555-0100',
    hours: '9:00 AM - 9:00 PM',
    description: 'Our Oak Ridge location',
    placeId: undefined,
    coordinates: undefined,
    socialLinkIds: undefined,
    cloverMerchantId: undefined,
    ogImagePath: undefined,
    seoDescription: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    name: 'Oak Ridge Updated',
    address: '456 Oak Blvd',
    city: 'Oak Ridge',
    state: 'TN',
    zip: '37830',
    phone: '865-555-0200',
    openHour: '10',
    openMinute: '00',
    openMeridiem: 'AM',
    closeHour: '8',
    closeMinute: '00',
    closeMeridiem: 'PM',
    description: 'Updated description',
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.set(key, value);
  }
  return fd;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('updateLocation server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a non-existent location slug', () => {
    it('returns a location-not-found error', async () => {
      stubAuthorisedActor();
      getLocationBySlugMock.mockResolvedValue(null);

      const result = await updateLocation(
        'ghost-location',
        null,
        makeFormData()
      );

      expect(result).toEqual({ error: 'Location not found.' });
      expect(upsertLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given an unsupported state', () => {
    it('returns an invalid-state error', async () => {
      stubAuthorisedActor();
      stubExistingLocation();

      const result = await updateLocation(
        'oak-ridge',
        null,
        makeFormData({ state: 'NY' })
      );

      expect(result).toEqual({
        error: 'State must be selected from the approved list.',
      });
      expect(upsertLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid hour option', () => {
    it('returns an invalid-hours error for out-of-range hour', async () => {
      stubAuthorisedActor();
      stubExistingLocation();

      const result = await updateLocation(
        'oak-ridge',
        null,
        makeFormData({ closeHour: '0' })
      );

      expect(result).toEqual({
        error: 'Hours must be selected from approved time options.',
      });
      expect(upsertLocationMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing required fields', () => {
    it('returns a required-fields error when address is absent', async () => {
      stubAuthorisedActor();
      stubExistingLocation();

      const result = await updateLocation(
        'oak-ridge',
        null,
        makeFormData({ address: '' })
      );

      expect(result).toEqual({ error: 'All fields are required.' });
    });
  });

  describe('given a valid payload', () => {
    it('passes buildHoursRange output to upsertLocation', async () => {
      stubAuthorisedActor();
      stubExistingLocation();
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateLocation('oak-ridge', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(upsertLocationMock).toHaveBeenCalledOnce();
      const [payload] = upsertLocationMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.hours).toBe('10:00 AM - 8:00 PM');
    });

    it('redirects to /admin/locations', async () => {
      stubAuthorisedActor();
      stubExistingLocation();
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateLocation('oak-ridge', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(redirectMock).toHaveBeenCalledWith('/admin/locations');
    });
  });
});
