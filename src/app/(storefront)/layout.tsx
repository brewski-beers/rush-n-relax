import { cookies } from 'next/headers';
import { Analytics } from '@vercel/analytics/next';
import { hasAdminSession } from '@/lib/admin-auth';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { StorefrontContent } from './StorefrontContent';

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initiallyVerified = cookieStore.get('ageVerified')?.value === 'true';
  const isAdminAuthenticated = await hasAdminSession('staff');

  return (
    <NavigationProvider>
      <StorefrontContent
        initiallyVerified={initiallyVerified}
        isAdminAuthenticated={isAdminAuthenticated}
      >
        {children}
      </StorefrontContent>
      <Analytics />
    </NavigationProvider>
  );
}
