import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirestore$ } from '@/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Category } from '@/types';

/**
 * CategoriesAdmin - Admin dashboard for category management
 */
export function CategoriesAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return <div>Access denied</div>;
  }

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const categoriesCollection = collection(getFirestore$(), 'categories');
      const snapshot = await getDocs(categoriesCollection);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as (Category & { id: string })[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      setIsLoading(true);
      const categoryDoc = doc(getFirestore$(), 'categories', categoryId);
      await deleteDoc(categoryDoc);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (error) {
      console.error('Failed to delete category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-categories">
      <div className="admin-header-bar">
        <h1>Categories Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          disabled={isLoading}
        >
          {showForm ? '✕ Cancel' : '+ New Category'}
        </button>
      </div>

      {showForm && (
        <div className="category-form-section">
          <CategoryForm
            onSuccess={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ['categories'] });
            }}
          />
        </div>
      )}

      <div className="categories-grid">
        {categories.length === 0 ? (
          <div className="empty-state">
            <p>No categories yet. Create one to get started!</p>
          </div>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="category-card">
              <div className="category-header">
                <h3>{category.name}</h3>
                <span className="category-id">{category.id}</span>
              </div>

              {category.description && (
                <p className="category-description">{category.description}</p>
              )}

              <div className="category-meta">
                <span className="meta-item">
                  {category.isActive ? '✓ Active' : '○ Inactive'}
                </span>
              </div>

              <div className="category-actions">
                <button
                  className="btn btn-sm btn-edit"
                  onClick={() => setEditingId(category.id)}
                  disabled={isLoading}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-delete"
                  onClick={() => handleDeleteCategory(category.id)}
                  disabled={isLoading}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editingId && (
        <CategoryEditor
          categoryId={editingId}
          categories={categories}
          onClose={() => setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['categories'] });
          }}
        />
      )}
    </div>
  );
}

/**
 * CategoryForm - Create new category
 */
function CategoryForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      // Create slug from name
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const categoriesCollection = collection(getFirestore$(), 'categories');
      const newDoc = doc(categoriesCollection, slug);

      await setDoc(newDoc, {
        name: formData.name,
        description: formData.description,
        isActive: formData.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onSuccess();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : 'Failed to create category'));
      setIsLoading(false);
    }
  };

  return (
    <form className="category-form" onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label>Category Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          disabled={isLoading}
          placeholder="e.g., Flower, Edibles"
        />
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          disabled={isLoading}
          rows={3}
          placeholder="Brief description of this category"
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

      <button type="submit" className="btn btn-primary" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Category'}
      </button>
    </form>
  );
}

/**
 * CategoryEditor - Edit existing category
 */
function CategoryEditor({
  categoryId,
  categories,
  onClose,
  onSuccess,
}: {
  categoryId: string;
  categories: (Category & { id: string })[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const category = categories.find((c) => c.id === categoryId);
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    isActive: category?.isActive || true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!category) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      const categoryDoc = doc(getFirestore$(), 'categories', categoryId);
      await updateDoc(categoryDoc, {
        name: formData.name,
        description: formData.description,
        isActive: formData.isActive,
        updatedAt: serverTimestamp(),
      });
      onSuccess();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : 'Failed to update category'));
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Category: {category.name}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="edit-form">
            <div className="form-group">
              <label>Category Name *</label>
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
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                disabled={isLoading}
                rows={3}
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
