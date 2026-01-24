import { Suspense, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useSuspenseQuery } from '@tanstack/react-query';
import { productRepository } from '@/repositories/ProductRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { AdminLayout } from '@/layouts/AdminLayout';
import { ProductsAdmin } from '@/components/ProductsAdmin';
import { CategoriesAdmin } from '@/components/CategoriesAdmin';
import { UsersAdmin } from '@/components/UsersAdmin';
import { StaffAdmin } from '@/components/StaffAdmin';
import { Skeleton } from '@/components/Skeleton';

/**
 * Simple error fallback for admin sections
 */
function ErrorFallback({ error }: FallbackProps) {
  return (
    <div className="admin-error">
      <h2>Something went wrong</h2>
      <p>{String(error)}</p>
    </div>
  );
}

/**
 * Error boundary wrapper for admin content
 */
function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Admin Page - Protected admin dashboard
 * Requires admin or manager role
 */
export function Admin() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'categories' | 'orders' | 'users' | 'staff'>('dashboard');

  // Wait for auth to load
  if (isLoading) {
    return <div className="admin-loading">Loading...</div>;
  }

  // Redirect non-admins/managers
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AdminLayout>
      <div className="admin-content-wrapper">
        {/* Tab Navigation */}
        <div className="admin-tabs">
          <button
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`tab ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            📦 Products
          </button>
          <button
            className={`tab ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            🏷️ Categories
          </button>
          <button
            className={`tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Users
          </button>
          <button
            className={`tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            🛒 Orders
          </button>
          {user.role === 'admin' && (
            <button
              className={`tab ${activeTab === 'staff' ? 'active' : ''}`}
              onClick={() => setActiveTab('staff')}
            >
              👔 Staff
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="admin-tab-content">
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'products' && (
            <Suspense fallback={<Skeleton />}>
              <ErrorBoundaryWrapper>
                <ProductsAdmin />
              </ErrorBoundaryWrapper>
            </Suspense>
          )}
          {activeTab === 'categories' && <CategoriesTab />}
          {activeTab === 'users' && (
            <Suspense fallback={<Skeleton />}>
              <ErrorBoundaryWrapper>
                <UsersAdmin />
              </ErrorBoundaryWrapper>
            </Suspense>
          )}
          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'staff' && user.role === 'admin' && (
            <Suspense fallback={<Skeleton />}>
              <ErrorBoundaryWrapper>
                <StaffTab />
              </ErrorBoundaryWrapper>
            </Suspense>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

/**
 * AdminDashboard - Overview of key metrics
 */
function AdminDashboard() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Suspense fallback={<Skeleton />}>
      <ErrorBoundaryWrapper>
        <AdminDashboardContent user={user} />
      </ErrorBoundaryWrapper>
    </Suspense>
  );
}

/**
 * AdminDashboardContent - Dashboard with metrics
 */
function AdminDashboardContent({ user }: { user: any }) {
  const { data: products = [] } = useSuspenseQuery({
    queryKey: ['products', 'admin', 'dashboard'],
    queryFn: () => productRepository.getAllProductsAsAdmin(user),
    staleTime: 5 * 60 * 1000,
  });

  const { data: userCounts = { customer: 0, staff: 0, manager: 0, admin: 0 } } = useSuspenseQuery({
    queryKey: ['user-counts', 'admin', 'dashboard'],
    queryFn: () => UserRepository.getUserCountByRole(),
    staleTime: 5 * 60 * 1000,
  });

  // Calculate metrics
  const totalProducts = products.length;
  const lowStockItems = products.filter(
    (p) => p.stock <= p.stockThreshold
  ).length;
  const avgMarkup =
    products.length > 0
      ? (
          products.reduce((sum, p) => sum + (p.markup || 0), 0) / products.length
        ).toFixed(1)
      : '0';

  const totalUsers = Object.values(userCounts).reduce((sum: number, count: any) => sum + count, 0);

  return (
    <div className="admin-dashboard">
      <h1>Dashboard</h1>
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-label">Total Products</div>
          <div className="card-value">{totalProducts}</div>
          <div className="card-action">
            <a href="#products" onClick={(e) => e.preventDefault()}>
              View all
            </a>
          </div>
        </div>
        <div className="dashboard-card">
          <div className="card-label">Low Stock Items</div>
          <div className="card-value" style={{ color: lowStockItems > 0 ? '#f87171' : '#4ade80' }}>
            {lowStockItems}
          </div>
          <div className="card-action">
            <small>{lowStockItems > 0 ? 'Reorder soon' : 'All good'}</small>
          </div>
        </div>
        <div className="dashboard-card">
          <div className="card-label">Avg Markup</div>
          <div className="card-value">{avgMarkup}%</div>
          <div className="card-action">
            <small>Across all products</small>
          </div>
        </div>
        <div className="dashboard-card">
          <div className="card-label">Total Users</div>
          <div className="card-value">{totalUsers}</div>
          <div className="card-action">
            <small>{userCounts.customer} customers</small>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          <div className="action-item">
            <h3>📦 Inventory Status</h3>
            <p>{lowStockItems} items below threshold</p>
            <button className="btn btn-sm btn-primary">View</button>
          </div>
          <div className="action-item">
            <h3>💰 Pricing Review</h3>
            <p>Check markups and profitability</p>
            <button className="btn btn-sm btn-primary">Review</button>
          </div>
          <div className="action-item">
            <h3>👥 Manage Users</h3>
            <p>Assign staff roles and permissions</p>
            <button className="btn btn-sm btn-primary">Manage</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * CategoriesTab - Category management
 */
function CategoriesTab() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ErrorBoundaryWrapper>
        <CategoriesAdmin />
      </ErrorBoundaryWrapper>
    </Suspense>
  );
}

/**
 * OrdersTab - Order management
 */
function OrdersTab() {
  return (
    <div className="admin-section">
      <h1>Orders</h1>
      <p className="placeholder">Order management coming soon</p>
    </div>
  );
}

/**
 * StaffTab - Staff management (admin only)
 */
function StaffTab() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ErrorBoundaryWrapper>
        <StaffAdmin />
      </ErrorBoundaryWrapper>
    </Suspense>
  );
}
