import Link from 'next/link';

interface Props {
  href: string;
  label: string;
}

export function AdminBackLink({ href, label }: Props) {
  return (
    <Link href={href} className="admin-back-link">
      ← Back to {label}
    </Link>
  );
}
