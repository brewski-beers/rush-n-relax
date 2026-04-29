import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeliveryDetailsForm } from '@/app/(storefront)/cart/DeliveryDetailsForm';
import { getShippingBlockReason } from '@/constants/shipping';
import type { ShippingAddress } from '@/types';

const EMPTY: ShippingAddress = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
};

function renderForm(overrides: Partial<ShippingAddress> = {}, email = '') {
  const onAddressChange = vi.fn();
  const onEmailChange = vi.fn();
  const utils = render(
    <DeliveryDetailsForm
      address={{ ...EMPTY, ...overrides }}
      email={email}
      onAddressChange={onAddressChange}
      onEmailChange={onEmailChange}
    />
  );
  return { ...utils, onAddressChange, onEmailChange };
}

describe('DeliveryDetailsForm', () => {
  describe('Given a fresh empty address', () => {
    it('renders all required fields and an email input', () => {
      renderForm();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/apt \/ suite/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^state$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/zip/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('does not show a block reason when no state is selected', () => {
      renderForm();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Given the user types into the name field', () => {
    it('emits an updated address via onAddressChange', () => {
      const { onAddressChange } = renderForm();
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Ada Lovelace' },
      });
      expect(onAddressChange).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ada Lovelace' })
      );
    });
  });

  describe('Given the user types into the email field', () => {
    it('emits the new email via onEmailChange', () => {
      const { onEmailChange } = renderForm();
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'a@b.co' },
      });
      expect(onEmailChange).toHaveBeenCalledWith('a@b.co');
    });
  });

  describe('Given an allowed state (TN)', () => {
    it('does not render a shipping-blocked alert', () => {
      renderForm({ state: 'TN' });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Given a blocked state (ID)', () => {
    it('renders the exact reason from getShippingBlockReason', () => {
      renderForm({ state: 'ID' });
      const expected = getShippingBlockReason('ID');
      expect(expected).not.toBeNull();
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(expected as string);
    });
  });
});
