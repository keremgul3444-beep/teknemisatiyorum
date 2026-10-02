import { useTranslation } from 'react-i18next';
import { AdminPage, ApprovalRow, EmptyState } from '@/components';
import { actions, useAdminItems } from '@/services';
import { attempt } from '@/services/errors';

export default function AdminBelgeler() {
  const { t } = useTranslation();
  const items = useAdminItems().filter((a) => a.kind === 'belge');
  return (
    <AdminPage>
      {items.length === 0 ? <EmptyState icon="check" title={t('admin.empty')} /> : items.map((i) => (
        <ApprovalRow key={i.id} item={i} onDecide={(s, r) => attempt(() => actions.setAdminStatus(i.id, s, r))} onOpenFile={(f) => attempt(() => actions.openDocument(f))} />
      ))}
    </AdminPage>
  );
}
