export const dynamic = 'force-dynamic';

import { listProducts } from '@/lib/repositories';

export default async function AdminProductsPage() {
  const products = await listProducts();

  return (
    <>
      <h1>Products</h1>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Status</th>
            <th>Featured</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.category}</td>
              <td>{product.status}</td>
              <td>{product.featured ? 'Yes' : 'No'}</td>
              <td>
                <button type="button" disabled>
                  Edit
                </button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={5} className="admin-empty">
                No products found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
