import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import '@/styles/index.css';
import { initializeApp } from '@/firebase';
import { reportWebVitals, logWebVitals, sendToFirebase } from '@/utils/reportWebVitals';
import { RootLayout } from '@/layouts/RootLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { PageLayout } from '@/layouts/PageLayout';
import { Home } from '@/pages/Home';
import { ProductDetail } from '@/pages/ProductDetail';
import { Admin } from '@/pages/Admin';
import { Account } from '@/pages/Account';
import { Kiosk } from '@/pages/Kiosk';
import { Login } from '@/pages/Login';
import { About } from '@/pages/About';
import { Locations } from '@/pages/Locations';
import { Contact } from '@/pages/Contact';
import CategoryProducts from '@/pages/CategoryProducts';

initializeApp();

// Initialize Web Vitals reporting
if (import.meta.env.DEV) {
  reportWebVitals(logWebVitals);
} else {
  reportWebVitals(sendToFirebase);
}

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
        path: '/login',
        element: (
          <PageLayout>
            <Login />
          </PageLayout>
        ),
      },
      {
        element: <AppLayout />,
        children: [
          {
            path: '/',
            element: (
              <PageLayout>
                <Home />
              </PageLayout>
            ),
          },
          {
            path: '/about',
            element: (
              <PageLayout>
                <About />
              </PageLayout>
            ),
          },
          {
            path: '/locations',
            element: (
              <PageLayout>
                <Locations />
              </PageLayout>
            ),
          },
          {
            path: '/contact',
            element: (
              <PageLayout>
                <Contact />
              </PageLayout>
            ),
          },
          {
            path: '/account',
            element: (
              <PageLayout>
                <Account />
              </PageLayout>
            ),
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
            path: '/products/:categorySlug/:productSlug',
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
          {
            path: '/kiosk',
            element: (
              <PageLayout>
                <Kiosk />
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
