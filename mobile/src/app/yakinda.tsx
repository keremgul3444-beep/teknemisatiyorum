import { useTranslation } from 'react-i18next';
import { EmptyState, Header, Screen, goBack } from '@/components';

/** Gerçek modda 2. dalga (usta, kaptan, güvenli ödeme) ekranlarının yerine gösterilir. Demo modunda prototip ekranları açıktır. */
export default function Yakinda() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Header title="" />
      <EmptyState icon="calendar" title={t('soon.title')} body={t('soon.body')} actionLabel={t('common.goBack')} onAction={goBack} />
    </Screen>
  );
}
