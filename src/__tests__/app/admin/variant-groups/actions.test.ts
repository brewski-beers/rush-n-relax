import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  upsertVariantTemplateMock,
  deleteVariantTemplateMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  upsertVariantTemplateMock: vi.fn().mockResolvedValue('new-template-id'),
  deleteVariantTemplateMock: vi.fn().mockResolvedValue(undefined),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  upsertVariantTemplate: upsertVariantTemplateMock,
  deleteVariantTemplate: deleteVariantTemplateMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createVariantGroupAction,
  updateVariantGroupAction,
  deleteVariantGroupAction,
} from '@/app/(admin)/admin/variant-groups/actions';
import type { VariantGroup } from '@/types/product';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'staff-uid',
    email: 'staff@rushnrelax.com',
    role: 'staff',
  });
}

function stubUnauthorised() {
  requireRoleMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT:/admin/login');
  });
}

const SAMPLE_GROUP: VariantGroup = {
  groupId: 'flower-weight',
  label: 'Weight',
  combinable: false,
  options: [
    { optionId: 'o1', label: '1g' },
    { optionId: 'o2', label: '3.5g' },
  ],
};

// ── createVariantGroupAction ───────────────────────────────────────────────

describe('createVariantGroupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('returns ok: false with the auth error message, does not call upsert', async () => {
      stubUnauthorised();

      const result = await createVariantGroupAction(
        'flower-weight',
        'Flower (weight)',
        SAMPLE_GROUP
      );

      expect(result).toMatchObject({ ok: false });
      expect(upsertVariantTemplateMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised caller with a valid payload', () => {
    it('calls upsertVariantTemplate with the correct args', async () => {
      stubAuthorisedActor();

      await createVariantGroupAction(
        'flower-weight',
        'Flower (weight)',
        SAMPLE_GROUP
      );

      expect(upsertVariantTemplateMock).toHaveBeenCalledOnce();
      expect(upsertVariantTemplateMock).toHaveBeenCalledWith({
        key: 'flower-weight',
        label: 'Flower (weight)',
        group: SAMPLE_GROUP,
      });
    });

    it('revalidates /admin/variant-groups', async () => {
      stubAuthorisedActor();

      await createVariantGroupAction(
        'flower-weight',
        'Flower (weight)',
        SAMPLE_GROUP
      );

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/variant-groups');
    });

    it('returns { ok: true, id } on success', async () => {
      stubAuthorisedActor();
      upsertVariantTemplateMock.mockResolvedValue('created-id');

      const result = await createVariantGroupAction(
        'flower-weight',
        'Flower (weight)',
        SAMPLE_GROUP
      );

      expect(result).toEqual({ ok: true, id: 'created-id' });
    });
  });
});

// ── updateVariantGroupAction ───────────────────────────────────────────────

describe('updateVariantGroupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('returns ok: false, does not call upsert', async () => {
      stubUnauthorised();

      const result = await updateVariantGroupAction(
        'flower-weight',
        'Updated Label',
        SAMPLE_GROUP
      );

      expect(result).toMatchObject({ ok: false });
      expect(upsertVariantTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised caller with a valid payload', () => {
    it('calls upsertVariantTemplate and revalidates /admin/variant-groups', async () => {
      stubAuthorisedActor();
      upsertVariantTemplateMock.mockResolvedValue('existing-id');

      const result = await updateVariantGroupAction(
        'flower-weight',
        'Updated Label',
        SAMPLE_GROUP
      );

      expect(upsertVariantTemplateMock).toHaveBeenCalledWith({
        key: 'flower-weight',
        label: 'Updated Label',
        group: SAMPLE_GROUP,
      });
      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/variant-groups');
      expect(result).toEqual({ ok: true, id: 'existing-id' });
    });
  });
});

// ── deleteVariantGroupAction ───────────────────────────────────────────────

describe('deleteVariantGroupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect thrown by requireRole', async () => {
      stubUnauthorised();

      await expect(deleteVariantGroupAction('template-id-abc')).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );

      expect(deleteVariantTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised caller', () => {
    it('calls deleteVariantTemplate with the correct ID', async () => {
      stubAuthorisedActor();

      await deleteVariantGroupAction('template-id-abc');

      expect(deleteVariantTemplateMock).toHaveBeenCalledOnce();
      expect(deleteVariantTemplateMock).toHaveBeenCalledWith('template-id-abc');
    });

    it('revalidates /admin/variant-groups', async () => {
      stubAuthorisedActor();

      await deleteVariantGroupAction('template-id-abc');

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/variant-groups');
    });
  });
});
