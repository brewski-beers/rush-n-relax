import { Metadata } from 'next';
import CartPage from './CartPage';
import { TestModeBanner } from '@/components/TestModeBanner';

export const metadata: Metadata = {
  title: 'Your Cart — Rush N Relax',
};

export default function CartRoute() {
  return (
    <>
      <TestModeBanner />
      <CartPage />
    </>
  );
}
