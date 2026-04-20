import { redirect } from 'next/navigation';
import { hasAdminSession } from '@/lib/admin-auth';

export default async function AdminIndexPage() {
  const isAdminAuthenticated = await hasAdminSession();
  redirect(isAdminAuthenticated ? '/admin/dashboard' : '/admin/login');
}
