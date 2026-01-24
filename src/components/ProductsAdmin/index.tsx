import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { productRepository } from '@/repositories/ProductRepository';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductAdmin } from '@/types';

/**
 * ProductsAdmin - Admin dashboard for product management
 * Shows all products with cost, markup, inventory
 */
export function ProductsAdmin() {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return <div>Access denied</div>;
  }

  const { data: products, refetch } = useSuspenseQuery({
    queryKey: ['products', 'admin', 'all', user.id],
    queryFn: () => productRepository.getAllProductsAsAdmin(user),
    staleTime: 2 * 60 * 1000,
  });

  const calculateMargin = (displayPrice: number, cost: number) => {
    if (cost === 0) return 0;
    return ((displayPrice - cost) / cost * 100).toFixed(2);
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      setDeletingId(productId);
      await productRepository.deleteProduct(productId, user);
      queryClient.invalidateQueries({
        queryKey: ['products', 'admin', 'all'],
      });
      setDeletingId(null);
    } catch (error) {
      console.error('Failed to delete product:', error);
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-products">
      <div className="admin-header-bar">
        <h1>Products Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕ Cancel' : '+ New Product'}
        </button>
      </div>

      {showForm && (
        <div className="product-form-section">
          <ProductForm
            onSuccess={() => {
              setShowForm(false);
              queryClient.invalidateQueries({
                queryKey: ['products', 'admin', 'all'],
              });
            }}
          />
        </div>
      )}

      <div className="products-table">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Display Price</th>
              <th>Cost</th>
              <th>Margin</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td className="product-name">
                  <strong>{product.name}</strong>
                  <br />
                  <small>{product.slug}</small>
                </td>
                <td>{product.categoryId}</td>
                <td>${product.displayPrice.toFixed(2)}</td>
                <td>${product.cost.toFixed(2)}</td>
                <td className="margin-cell">
                  <span className="margin-badge">
                    {calculateMargin(product.displayPrice, product.cost)}%
                  </span>
                </td>
                <td>
                  <span
                    className={`stock-badge ${
                      product.stock > product.stockThreshold
                        ? 'in-stock'
                        : 'low-stock'
                    }`}
                  >
                    {product.stock}
                  </span>
                </td>
                <td>
                  {product.isActive ? (
                    <span className="status-active">✓ Active</span>
                  ) : (
                    <span className="status-inactive">○ Draft</span>
                  )}
                </td>
                <td className="actions">
                  <button
                    className="btn btn-sm btn-edit"
                    onClick={() => setEditingId(product.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-delete"
                    onClick={() => handleDeleteProduct(product.id)}
                    disabled={deletingId === product.id}
                  >
                    {deletingId === product.id ? '...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId && (
        <ProductEditor
          productId={editingId}
          products={products}
          onClose={() => setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            queryClient.invalidateQueries({
              queryKey: ['products', 'admin', 'all'],
            });
          }}
        />
      )}
    </div>
  );
}

/**
 * ProductForm - Create new product
 */
function ProductForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    categoryId: 'flower',
    displayPrice: '',
    cost: '',
    stock: '',
    stockThreshold: '5',
    description: '',
    imageUrl: '',
    thcContent: '',
    cbdContent: '',
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await productRepository.createProduct(
        {
          name: formData.name,
          slug: formData.slug,
          categoryId: formData.categoryId,
          displayPrice: parseFloat(formData.displayPrice),
          cost: parseFloat(formData.cost),
          stock: parseInt(formData.stock),
          stockThreshold: parseInt(formData.stockThreshold) || 5,
          description: formData.description,
          imageUrl: formData.imageUrl,
          thcContent: formData.thcContent,
          cbdContent: formData.cbdContent,
          markup: 0,
          notes: '',
          tags: [],
          locationId: 'default',
          isActive: formData.isActive,
        },
        user
      );
      onSuccess();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : 'Failed to create product'));
      setIsLoading(false);
    }
  };

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label>Product Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
        <div className="form-group">
          <label>Slug *</label>
          <input
            type="text"
            name="slug"
            value={formData.slug}
            onChange={handleChange}
            required
            disabled={isLoading}
            placeholder="e.g., blue-dream"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Category *</label>
          <select
            name="categoryId"
            value={formData.categoryId}
            onChange={handleChange}
            required
            disabled={isLoading}
          >
            <option value="flower">Flower</option>
            <option value="edibles">Edibles</option>
            <option value="concentrates">Concentrates</option>
            <option value="accessories">Accessories</option>
          </select>
        </div>
        <div className="form-group">
          <label>Display Price ($) *</label>
          <input
            type="number"
            name="displayPrice"
            value={formData.displayPrice}
            onChange={handleChange}
            step="0.01"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Cost ($) *</label>
          <input
            type="number"
            name="cost"
            value={formData.cost}
            onChange={handleChange}
            step="0.01"
            required
            disabled={isLoading}
          />
        </div>
        <div className="form-group">
          <label>Stock *</label>
          <input
            type="number"
            name="stock"
            value={formData.stock}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Stock Threshold</label>
          <input
            type="number"
            name="stockThreshold"
            value={formData.stockThreshold}
            onChange={handleChange}
            disabled={isLoading}
            placeholder="e.g., 5"
          />
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              disabled={isLoading}
            />
            Active
          </label>
        </div>
      </div>

      <div className="form-group full-width">
        <label>Description</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          disabled={isLoading}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>THC Content</label>
          <input
            type="text"
            name="thcContent"
            value={formData.thcContent}
            onChange={handleChange}
            disabled={isLoading}
            placeholder="e.g., 22%"
          />
        </div>
        <div className="form-group">
          <label>CBD Content</label>
          <input
            type="text"
            name="cbdContent"
            value={formData.cbdContent}
            onChange={handleChange}
            disabled={isLoading}
            placeholder="e.g., 1%"
          />
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Product'}
      </button>
    </form>
  );
}

/**
 * ProductEditor - Edit existing product (modal/inline)
 */
function ProductEditor({
  productId,
  products,
  onClose,
  onSuccess,
}: {
  productId: string;
  products: ProductAdmin[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const product = products.find((p) => p.id === productId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    displayPrice: product?.displayPrice.toString() || '',
    cost: product?.cost.toString() || '',
    stock: product?.stock.toString() || '',
    stockThreshold: product?.stockThreshold.toString() || '5',
    isActive: product?.isActive || true,
  });

  if (!user || !product) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await productRepository.updateProduct(
        productId,
        {
          displayPrice: parseFloat(formData.displayPrice),
          cost: parseFloat(formData.cost),
          stock: parseInt(formData.stock),
          stockThreshold: parseInt(formData.stockThreshold),
          isActive: formData.isActive,
        },
        user
      );
      onSuccess();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : 'Failed to update product'));
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Product: {product.name}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="edit-form">
            <div className="form-row">
              <div className="form-group">
                <label>Display Price ($) *</label>
                <input
                  type="number"
                  name="displayPrice"
                  value={formData.displayPrice}
                  onChange={handleChange}
                  step="0.01"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label>Cost ($) *</label>
                <input
                  type="number"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  step="0.01"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Stock *</label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label>Stock Threshold</label>
                <input
                  type="number"
                  name="stockThreshold"
                  value={formData.stockThreshold}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                Active
              </label>
            </div>

            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
