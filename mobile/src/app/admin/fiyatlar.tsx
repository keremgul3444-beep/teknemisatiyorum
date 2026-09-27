import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { AdminPage, Button, Card, Field, T } from '@/components';
import { actions } from '@/services';
import type { ApiProduct } from '@/services/api/mappers';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';

/** Yönetim · Fiyatlar: her ürünün site ve uygulama fiyatı (TL, tam sayı). Deneme fiyatı uyarısı. */
export default function AdminFiyatlar() {
  const products = useRemote(() => actions.products());
  return (
    <AdminPage>
      {(products.data ?? []).map((p) => <PriceRow key={p.code} product={p} onSaved={products.reload} />)}
    </AdminPage>
  );
}

function PriceRow({ product: p, onSaved }: { product: ApiProduct; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [web, setWeb] = useState(String(Math.round(p.priceWebKurus / 100)));
  const [app, setApp] = useState(String(Math.round(p.priceAppKurus / 100)));
  const ok = /^\d{1,7}$/.test(web) && /^\d{1,7}$/.test(app) && Number(web) >= 1 && Number(app) >= 1;
  const save = () => attempt(async () => {
    await actions.adminSetPrice(p.code, { priceWebKurus: Number(web) * 100, priceAppKurus: Number(app) * 100 });
    await onSaved();
  });
  return (
    <Card>
      <T variant="h3">{t(`promo.product.${p.code}`, { defaultValue: p.code })}</T>
      {p.isTrialPrice ? <T variant="caption" color={colors.warning}>{t('promo.trialWarning')}</T> : null}
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <View style={{ flex: 1 }}><Field label={t('admin.priceWeb')} value={web} onChangeText={setWeb} keyboardType="number-pad" maxLength={7} /></View>
        <View style={{ flex: 1 }}><Field label={t('admin.priceApp')} value={app} onChangeText={setApp} keyboardType="number-pad" maxLength={7} /></View>
      </View>
      <Button small title={t('admin.save')} disabled={!ok} onPress={save} />
    </Card>
  );
}
