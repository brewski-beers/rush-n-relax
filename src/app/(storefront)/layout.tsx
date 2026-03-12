import { cookies } from 'next/headers';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { StorefrontContent } from './StorefrontContent';

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initiallyVerified = cookieStore.get('ageVerified')?.value === 'true';

  return (
    <NavigationProvider>
      <StorefrontContent initiallyVerified={initiallyVerified}>
        {children}
      </StorefrontContent>
    </NavigationProvider>
  );
}
