import './styles/index.css';
import { initializeApp } from './firebase';

initializeApp();

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="header">
    <h1>Rush N Relax</h1>
    <nav>
      <button id="staff-login" class="btn-secondary">Staff Login</button>
    </nav>
  </header>
  <main class="main">
    <section class="hero">
      <h2>Premium Cannabis Products</h2>
      <p>Coming soon...</p>
    </section>
    <div id="products" class="product-grid"></div>
  </main>
`;
