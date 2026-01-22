import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@/styles/index.css';
import { initializeApp } from '@/firebase';
import { Home } from '@/pages/Home';
import { ProductDetail } from '@/pages/ProductDetail';
import { Admin } from '@/pages/Admin';
import CategoryProducts from '@/pages/CategoryProducts';

initializeApp();

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products/category/:category" element={<CategoryProducts />} />
        <Route path="/products/:category/:slug" element={<ProductDetail />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

const appRoot = document.getElementById('app');
if (appRoot) {
  const root = ReactDOM.createRoot(appRoot);
  root.render(<App />);
} else {
  console.error('Root element #app not found. Check index.html.');
}
