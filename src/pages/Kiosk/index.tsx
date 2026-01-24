import { useState, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useSuspenseQuery } from '@tanstack/react-query';
import { productRepository } from '@/repositories/ProductRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { queryClient } from '@/lib/queryClient';
import { Skeleton } from '@/components/Skeleton';
import type { User, ProductStaff } from '@/types';

export function Kiosk() {
  const { user } = useAuth();

  // Redirect non-staff
  if (!user || (user.role !== 'staff' && user.role !== 'manager' && user.role !== 'admin')) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="kiosk-container">
      <div className="kiosk-header">
        <h1>📱 In-Store Kiosk</h1>
        <p>Register guests, assist customers, and complete sales</p>
      </div>

      <Suspense fallback={<Skeleton />}>
        <KioskContent staffUser={user} />
      </Suspense>
    </div>
  );
}

function KioskContent({ staffUser }: { staffUser: User }) {
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'customers' | 'register' | 'cart'>('customers');

  const { data: allUsers = [] } = useSuspenseQuery({
    queryKey: ['users', 'kiosk'],
    queryFn: () => UserRepository.getAllUsers(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: allProducts = [] } = useSuspenseQuery({
    queryKey: ['products', 'staff', 'kiosk'],
    queryFn: () => productRepository.getAllProductsAsAdmin(staffUser),
    staleTime: 2 * 60 * 1000,
  });

  // Filter to guests/customers visible to staff
  const guestsAndCustomers = allUsers.filter(
    (u) => u.role === 'guest' || u.role === 'customer'
  );
  const selectedGuest = selectedGuestId ? guestsAndCustomers.find((u) => u.id === selectedGuestId) : null;

  const handleAddToCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const handleCompleteOrder = async () => {
    if (!selectedGuest || cart.length === 0) {
      alert('Select a customer and add items to cart');
      return;
    }

    // Stub order creation
    const orderData = {
      customerId: selectedGuest.id,
      items: cart.map((item) => {
        const product = allProducts.find((p) => p.id === item.productId);
        return {
          productId: item.productId,
          name: product?.name || 'Unknown',
          price: product?.displayPrice || 0,
          quantity: item.quantity,
        };
      }),
      subtotal: cart.reduce((sum, item) => {
        const product = allProducts.find((p) => p.id === item.productId);
        return sum + (product?.displayPrice || 0) * item.quantity;
      }, 0),
      tax: 0,
      total: 0,
      paymentMethod: 'cash',
      staffId: staffUser.id,
      status: 'completed',
      createdAt: new Date(),
    };

    console.log('[Kiosk] Order stub:', orderData);
    alert(`Order saved for ${selectedGuest.displayName || selectedGuest.email}. (Stub — not persisted)`);
    setCart([]);
  };

  const handlePromoteGuest = async (guestId: string) => {
    if (!window.confirm('Promote this guest to customer?')) return;
    try {
      await UserRepository.updateUserRole(guestId, 'customer', staffUser.id, staffUser.role);
      queryClient.invalidateQueries({ queryKey: ['users', 'kiosk'] });
      alert('Guest promoted to customer!');
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="kiosk-grid">
      {/* Sidebar: Customers and Register */}
      <aside className="kiosk-sidebar">
        <div className="sidebar-tabs">
          <button
            className={`tab ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            👥 Guests & Customers
          </button>
          <button
            className={`tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            ➕ Register Guest
          </button>
        </div>

        {activeTab === 'customers' && (
          <div className="customers-list">
            {guestsAndCustomers.length === 0 ? (
              <p className="empty-note">No guests or customers found</p>
            ) : (
              guestsAndCustomers.map((u) => (
                <div
                  key={u.id}
                  className={`customer-card ${selectedGuestId === u.id ? 'selected' : ''}`}
                  onClick={() => setSelectedGuestId(u.id)}
                >
                  <div className="customer-name">
                    {u.displayName || u.email}
                    <span className={`role-badge role-${u.role}`}>{u.role}</span>
                  </div>
                  {u.role === 'guest' && (
                    <button
                      className="promote-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePromoteGuest(u.id);
                      }}
                    >
                      Promote
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'register' && (
          <RegisterGuestForm
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['users', 'kiosk'] });
              setActiveTab('customers');
            }}
            createdBy={staffUser.id}
          />
        )}
      </aside>

      {/* Main: Products and Cart */}
      <main className="kiosk-main">
        {selectedGuest ? (
          <>
            <div className="selected-customer">
              <strong>{selectedGuest.displayName || selectedGuest.email}</strong>
              <small>{selectedGuest.role}</small>
            </div>

            {/* Products Grid */}
            <div className="products-section">
              <h2>Add Items to Cart</h2>
              <div className="products-grid">
                {allProducts.filter((p) => p.isActive).map((product) => (
                  <div key={product.id} className="product-card">
                    <div className="product-name">{product.name}</div>
                    <div className="product-price">${product.displayPrice.toFixed(2)}</div>
                    <button
                      className="add-btn"
                      onClick={() => handleAddToCart(product.id)}
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart Preview */}
            {cart.length > 0 && (
              <div className="cart-preview">
                <h3>Cart ({cart.length} items)</h3>
                <div className="cart-items">
                  {cart.map((item) => {
                    const product = allProducts.find((p) => p.id === item.productId);
                    return (
                      <div key={item.productId} className="cart-item">
                        <span>{product?.name}</span>
                        <span>×{item.quantity}</span>
                        <span>${((product?.displayPrice || 0) * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="cart-total">
                  <strong>
                    Total: $
                    {cart
                      .reduce((sum, item) => {
                        const product = allProducts.find((p) => p.id === item.productId);
                        return sum + (product?.displayPrice || 0) * item.quantity;
                      }, 0)
                      .toFixed(2)}
                  </strong>
                </div>
                <button className="complete-btn" onClick={handleCompleteOrder}>
                  ✓ Complete Order
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="no-selection">
            <p>Select a guest or customer to begin</p>
          </div>
        )}
      </main>

      <style>{`
        .kiosk-container { padding: 2rem 1rem; background: #0f1419; min-height: 100vh; }
        .kiosk-header { margin-bottom: 2rem; text-align: center; }
        .kiosk-header h1 { margin: 0; font-size: 2rem; }
        .kiosk-header p { margin: 0.5rem 0 0; color: #aaa; }
        .kiosk-grid { display: grid; grid-template-columns: 280px 1fr; gap: 2rem; max-width: 1400px; margin: 0 auto; }
        .kiosk-sidebar { background: #1a1f25; border-radius: 0.5rem; padding: 1rem; height: fit-content; }
        .sidebar-tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
        .sidebar-tabs .tab { flex: 1; padding: 0.5rem; border: 1px solid #333; background: transparent; color: #aaa; border-radius: 0.375rem; cursor: pointer; font-size: 0.85rem; }
        .sidebar-tabs .tab.active { background: var(--primary); color: white; border-color: var(--primary); }
        .customers-list { max-height: 500px; overflow-y: auto; }
        .customer-card { padding: 0.75rem; border: 1px solid #333; border-radius: 0.375rem; margin-bottom: 0.5rem; cursor: pointer; background: #0f1419; transition: all 0.2s; }
        .customer-card:hover { border-color: var(--primary); background: #16202a; }
        .customer-card.selected { background: var(--primary); border-color: var(--primary); color: white; }
        .customer-name { font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
        .role-badge { font-size: 0.65rem; padding: 0.2rem 0.4rem; border-radius: 0.25rem; background: rgba(255,255,255,0.2); }
        .promote-btn { margin-top: 0.5rem; width: 100%; padding: 0.4rem; border: 1px solid #66bb6a; background: transparent; color: #66bb6a; border-radius: 0.25rem; cursor: pointer; font-size: 0.8rem; }
        .promote-btn:hover { background: rgba(102, 187, 106, 0.1); }
        .kiosk-main { background: #1a1f25; border-radius: 0.5rem; padding: 1.5rem; }
        .selected-customer { background: #2e3731; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 1rem; }
        .selected-customer strong { display: block; font-size: 1.1rem; }
        .selected-customer small { color: #aaa; }
        .products-section { margin-bottom: 2rem; }
        .products-section h2 { margin: 0 0 1rem 0; }
        .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.75rem; }
        .product-card { background: #0f1419; border: 1px solid #333; border-radius: 0.375rem; padding: 0.75rem; text-align: center; }
        .product-name { font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem; }
        .product-price { color: var(--secondary); font-weight: bold; margin-bottom: 0.5rem; }
        .add-btn { width: 100%; padding: 0.5rem; border: 1px solid var(--secondary); background: transparent; color: var(--secondary); border-radius: 0.25rem; cursor: pointer; }
        .add-btn:hover { background: rgba(244, 164, 96, 0.1); }
        .cart-preview { background: #2e3731; border-radius: 0.5rem; padding: 1rem; }
        .cart-items { margin: 0.75rem 0; max-height: 200px; overflow-y: auto; }
        .cart-item { display: grid; grid-template-columns: 1fr 50px 80px; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid #444; font-size: 0.9rem; }
        .cart-total { text-align: right; margin: 0.75rem 0; font-size: 1.1rem; color: #a5d6a7; }
        .complete-btn { width: 100%; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 600; }
        .complete-btn:hover { background: #1e5a1e; }
        .no-selection { display: flex; align-items: center; justify-content: center; min-height: 400px; color: #666; }
        .empty-note { color: #666; text-align: center; padding: 1rem; }
        @media (max-width: 900px) {
          .kiosk-grid { grid-template-columns: 1fr; }
          .products-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
        }
      `}</style>
    </div>
  );
}

function RegisterGuestForm({ onSuccess, createdBy }: { onSuccess: () => void; createdBy: string }) {
  const [displayName, setDisplayName] = useState('');
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('phone');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!contact || contact.replace(/\D/g, '').length < 10) {
      setMessage('Enter valid contact info');
      return;
    }

    try {
      setSubmitting(true);
      await UserRepository.createGuest({ displayName, contactMethod, contact }, createdBy);
      setMessage('Guest registered!');
      setDisplayName('');
      setContact('');
      setTimeout(() => {
        onSuccess();
        setMessage(null);
      }, 800);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="register-form">
      <input
        type="text"
        placeholder="Name (optional)"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        className="form-input"
      />
      <select
        value={contactMethod}
        onChange={(e) => setContactMethod(e.target.value as 'email' | 'phone')}
        className="form-input"
      >
        <option value="phone">Phone</option>
        <option value="email">Email</option>
      </select>
      <input
        type={contactMethod === 'email' ? 'email' : 'tel'}
        placeholder={contactMethod === 'phone' ? '(555) 123-4567' : 'email@example.com'}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        required
        className="form-input"
      />
      <button type="submit" disabled={submitting} className="register-btn">
        {submitting ? 'Adding…' : 'Register Guest'}
      </button>
      {message && <p className="message">{message}</p>}
      <style>{`
        .register-form { display: flex; flex-direction: column; gap: 0.75rem; }
        .form-input { padding: 0.6rem; border: 1px solid #333; border-radius: 0.375rem; background: #0f1419; color: #f5f5f5; }
        .register-btn { padding: 0.7rem; background: var(--primary); color: white; border: none; border-radius: 0.375rem; cursor: pointer; font-weight: 600; }
        .register-btn:disabled { opacity: 0.6; }
        .message { font-size: 0.85rem; color: #a5d6a7; text-align: center; }
      `}</style>
    </form>
  );
}
