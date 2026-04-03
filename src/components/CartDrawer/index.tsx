'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { formatCents } from '@/utils/currency';
import './CartDrawer.css';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQty, total, itemCount } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape key handler
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Move focus into drawer when it opens
    const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled])'
    );
    if (firstFocusable) setTimeout(() => firstFocusable.focus(), 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="cart-backdrop"
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') onClose();
        }}
        role="button"
        tabIndex={0}
        aria-label="Close cart"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        <div className="cart-drawer-header">
          <h2 className="cart-drawer-title">
            Your Cart{itemCount > 0 ? ` (${itemCount})` : ''}
          </h2>
          <button
            type="button"
            className="cart-drawer-close"
            onClick={onClose}
            aria-label="Close cart"
          >
            ×
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cart-drawer-empty">
            <p>Your cart is empty.</p>
            <Link
              href="/products"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <>
            <ul className="cart-drawer-items" aria-label="Cart items">
              {items.map(item => (
                <li key={item.productId} className="cart-item">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.productName}</span>
                    <span className="cart-item-price">
                      {formatCents(item.unitPrice)}
                    </span>
                  </div>
                  <div className="cart-item-controls">
                    <button
                      type="button"
                      className="cart-qty-btn"
                      onClick={() =>
                        item.quantity === 1
                          ? removeItem(item.productId)
                          : updateQty(item.productId, item.quantity - 1)
                      }
                      aria-label={`Decrease quantity of ${item.productName}`}
                    >
                      −
                    </button>
                    <span className="cart-item-qty" aria-label="Quantity">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="cart-qty-btn"
                      onClick={() =>
                        updateQty(item.productId, item.quantity + 1)
                      }
                      aria-label={`Increase quantity of ${item.productName}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="cart-item-remove"
                      onClick={() => removeItem(item.productId)}
                      aria-label={`Remove ${item.productName}`}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="cart-drawer-footer">
              <div className="cart-subtotal">
                <span>Subtotal</span>
                <span>{formatCents(total)}</span>
              </div>
              <Link
                href="/cart"
                className="btn btn-secondary cart-view-btn"
                onClick={onClose}
              >
                View Cart
              </Link>
              <button
                type="button"
                className="btn btn-primary cart-checkout-btn"
                disabled={items.length === 0}
                aria-disabled={items.length === 0}
              >
                Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Cart icon button with item count badge — intended for use in Navigation.
 */
export function CartIconButton({ onClick }: { onClick: () => void }) {
  const { itemCount } = useCart();

  return (
    <button
      type="button"
      className="cart-icon-button"
      onClick={onClick}
      aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ''}`}
    >
      <span className="cart-icon" aria-hidden="true">
        🛒
      </span>
      {itemCount > 0 && (
        <span className="cart-badge" aria-hidden="true">
          {itemCount}
        </span>
      )}
    </button>
  );
}
