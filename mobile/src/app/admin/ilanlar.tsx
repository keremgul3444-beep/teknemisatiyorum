import { useTranslation } from 'react-i18next';
import { AdminPage, ApprovalRow, EmptyState } from '@/components';
import { actions, useAdminItems } from '@/services';
import { attempt } from '@/services/errors';

export default function AdminIlanlar() {
  const { t } = useTranslation();
  const items = useAdminItems().filter((a) => a.kind === 'ilan');
  return (
    <AdminPage>
      {items.length === 0 ? <EmptyState icon="check" title={t('admin.empty')} /> : items.map((i) => (
        <ApprovalRow key={i.id} item={i} onDecide={(s, r) => attempt(() => actions.setAdminStatus(i.id, s, r))} />
      ))}
    </AdminPage>
  );
}
