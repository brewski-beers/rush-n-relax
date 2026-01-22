import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import '@/styles/index.css';
import { initializeApp } from '@/firebase';
import { RootLayout } from '@/layouts/RootLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { PageLayout } from '@/layouts/PageLayout';
import { Home } from '@/pages/Home';
import { ProductDetail } from '@/pages/ProductDetail';
import { Admin } from '@/pages/Admin';
import CategoryProducts from '@/pages/CategoryProducts';

initializeApp();

/**
 * Application router with nested layouts
 * Structure:
 * - RootLayout (providers + error boundary)
 *   - AppLayout (header + main + footer)
 *     - PageLayout (suspense + error boundary per page)
 *       - Page Component
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/',
            element: <Home />,
          },
          {
            path: '/products/category/:category',
            element: (
              <PageLayout>
                <CategoryProducts />
              </PageLayout>
            ),
          },
          {
            path: '/products/:category/:slug',
            element: (
              <PageLayout>
                <ProductDetail />
              </PageLayout>
            ),
          },
          {
            path: '/admin',
            element: (
              <PageLayout>
                <Admin />
              </PageLayout>
            ),
          },
        ],
      },
    ],
  },
]);

const appRoot = document.getElementById('app');
if (appRoot) {
  const root = ReactDOM.createRoot(appRoot);
  root.render(<RouterProvider router={router} />);
} else {
  console.error('Root element #app not found. Check index.html.');
}
