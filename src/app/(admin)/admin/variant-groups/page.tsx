export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listVariantTemplates } from '@/lib/repositories';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { deleteVariantGroupAction } from './actions';

export default async function AdminVariantGroupsPage() {
  await requireRole('staff');

  const templates = await listVariantTemplates();

  return (
    <>
      <div className="admin-page-header">
        <h1>Variant Groups</h1>
        <Link href="/admin/variant-groups/new" className="admin-btn-primary">
          New Variant Group
        </Link>
      </div>
      <p className="admin-hint">
        Variant groups define reusable option sets (e.g. &ldquo;Flower
        Weights&rdquo;). Attach them to products from the product editor.
        Editing a group here does not affect products that have already applied
        it.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Key</th>
              <th>Options</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(tpl => (
              <tr key={tpl.id}>
                <td>{tpl.label}</td>
                <td>
                  <code>{tpl.key}</code>
                </td>
                <td>
                  {tpl.group.options.length === 0
                    ? '—'
                    : tpl.group.options.map(o => o.label).join(', ')}
                </td>
                <td className="admin-actions">
                  <Link href={`/admin/variant-groups/${tpl.id}/edit`}>
                    Edit
                  </Link>
                  <ConfirmButton
                    action={deleteVariantGroupAction.bind(null, tpl.id)}
                    message={`Delete variant group "${tpl.label}"? This does not affect products that already use it.`}
                  >
                    Delete
                  </ConfirmButton>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={4} className="admin-empty">
                  No variant groups defined yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
