import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/index.css';
import { initializeApp } from './firebase';
import { Home } from './pages/Home';
import { Admin } from './pages/Admin';

initializeApp();

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
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
