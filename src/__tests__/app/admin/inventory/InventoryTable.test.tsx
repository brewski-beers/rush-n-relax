import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

const { updateInventoryItemMock, routerRefreshMock } = vi.hoisted(() => ({
  updateInventoryItemMock: vi.fn(),
  routerRefreshMock: vi.fn(),
}));

vi.mock('@/app/(admin)/admin/inventory/[locationId]/actions', () => ({
  updateInventoryItem: updateInventoryItemMock,
  updateVariantPricing: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

import InventoryTable, {
  type InventoryRow,
} from '@/app/(admin)/admin/inventory/[locationId]/InventoryTable';

const TOAST_COPY = 'Set qty above 0 to re-enable online availability.';

function baseRow(overrides: Partial<InventoryRow> = {}): InventoryRow {
  return {
    id: 'prod-1',
    slug: 'prod-1',
    name: 'Test Flower',
    category: 'flower',
    image: null,
    quantity: 5,
    inStock: true,
    availableOnline: true,
    availablePickup: true,
    featured: false,
    ...overrides,
  } as InventoryRow;
}

describe('InventoryTable — qty=0 cascade toast (issue #198)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateInventoryItemMock.mockResolvedValue({});
  });

  describe('given qty is edited to 0 and committed via blur', () => {
    it('shows the inline toast with the exact copy', async () => {
      render(
        <InventoryTable
          rows={[baseRow({ availableOnline: true })]}
          locationId="hub"
          isOnline
        />
      );
      const qty = screen.getByLabelText(/Quantity for Test Flower/i);
      await act(async () => {
        fireEvent.change(qty, { target: { value: '0' } });
        fireEvent.blur(qty);
      });
      await waitFor(() => {
        expect(screen.getByText(TOAST_COPY)).toBeInTheDocument();
      });
      expect(updateInventoryItemMock).toHaveBeenCalledWith(
        'hub',
        'prod-1',
        expect.objectContaining({ quantity: 0 })
      );
    });
  });

  describe('given qty is committed to 0 and the row had no availability flags', () => {
    it('does not show the toast (nothing cascaded)', async () => {
      render(
        <InventoryTable
          rows={[
            baseRow({
              quantity: 3,
              availableOnline: false,
              availablePickup: false,
              featured: false,
            }),
          ]}
          locationId="hub"
          isOnline
        />
      );
      const qty = screen.getByLabelText(/Quantity for Test Flower/i);
      await act(async () => {
        fireEvent.change(qty, { target: { value: '0' } });
        fireEvent.blur(qty);
      });
      await waitFor(() => {
        expect(updateInventoryItemMock).toHaveBeenCalled();
      });
      expect(screen.queryByText(TOAST_COPY)).not.toBeInTheDocument();
    });
  });

  describe('given inStock is toggled off (qty -> 0 via checkbox)', () => {
    it('shows the inline toast', async () => {
      render(
        <InventoryTable
          rows={[baseRow({ availableOnline: true })]}
          locationId="hub"
          isOnline
        />
      );
      const inStock = screen.getByLabelText(/In stock for Test Flower/i);
      await act(async () => {
        fireEvent.click(inStock);
      });
      await waitFor(() => {
        expect(screen.getByText(TOAST_COPY)).toBeInTheDocument();
      });
    });
  });

  describe('given qty goes from 0 back above 0', () => {
    it('does NOT auto-restore availability flags (server remains source of truth)', async () => {
      render(
        <InventoryTable
          rows={[
            baseRow({
              quantity: 0,
              inStock: false,
              availableOnline: false,
              availablePickup: false,
              featured: false,
            }),
          ]}
          locationId="hub"
          isOnline
        />
      );
      const qty = screen.getByLabelText(/Quantity for Test Flower/i);
      await act(async () => {
        fireEvent.change(qty, { target: { value: '5' } });
        fireEvent.blur(qty);
      });
      await waitFor(() => {
        expect(updateInventoryItemMock).toHaveBeenCalled();
      });
      const [, , patch] = updateInventoryItemMock.mock.calls[0];
      expect(patch.availableOnline).toBeUndefined();
      expect(patch).not.toHaveProperty('availableOnline', true);
      expect(screen.queryByText(TOAST_COPY)).not.toBeInTheDocument();
    });
  });
});
