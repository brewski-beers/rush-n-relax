import { Metadata } from 'next';
import CartPage from './CartPage';

export const metadata: Metadata = {
  title: 'Your Cart — Rush N Relax',
};

export default function CartRoute() {
  return <CartPage />;
}
