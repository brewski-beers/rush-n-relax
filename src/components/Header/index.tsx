import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="header">
      <img 
        src="https://images.squarespace-cdn.com/content/v1/68acc910aaec577b133ae9bc/0d4f238c-4238-42cb-803c-bf391d18ef69/RNR%2BLogo.png?format=150w" 
        alt="Rush N Relax Logo" 
        className="logo" 
      />
      <nav className="nav">
        <Link to="/about">About</Link>
        <Link to="/products">Products</Link>
        <Link to="/locations">Locations</Link>
        <Link to="/contact">Contact</Link>
      </nav>
    </header>
  );
}
