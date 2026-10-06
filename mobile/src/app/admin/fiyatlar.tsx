import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { AdminPage, Button, Card, Field, Loading, T } from '@/components';
import { actions } from '@/services';
import type { ApiProduct } from '@/services/api/mappers';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';
import { kurusToInput, parseLira } from '@/features/promo';

/** Yönetim · Fiyatlar: her ürünün site ve uygulama fiyatı (TL, tam sayı). Deneme fiyatı uyarısı. */
export default function AdminFiyatlar() {
  const products = useRemote(() => actions.products());
  return (
    <AdminPage>
      {products.loading ? <Loading /> : null}
      {(products.data ?? []).map((p) => <PriceRow key={p.code} product={p} onSaved={products.reload} />)}
    </AdminPage>
  );
}

function PriceRow({ product: p, onSaved }: { product: ApiProduct; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [web, setWeb] = useState(kurusToInput(p.priceWebKurus));
  const [app, setApp] = useState(kurusToInput(p.priceAppKurus));
  const webK = parseLira(web);
  const appK = parseLira(app);
  const ok = webK !== null && appK !== null && webK >= 100 && appK >= 100;
  const save = () => attempt(async () => {
    await actions.adminSetPrice(p.code, { priceWebKurus: webK!, priceAppKurus: appK! });
    await onSaved();
  });
  return (
    <Card>
      <T variant="h3">{t(`promo.product.${p.code}`, { defaultValue: p.code })}</T>
      {p.isTrialPrice ? <T variant="caption" color={colors.warning}>{t('promo.trialWarning')}</T> : null}
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <View style={{ flex: 1 }}><Field label={t('admin.priceWeb')} value={web} onChangeText={setWeb} keyboardType="decimal-pad" maxLength={10} /></View>
        <View style={{ flex: 1 }}><Field label={t('admin.priceApp')} value={app} onChangeText={setApp} keyboardType="decimal-pad" maxLength={10} /></View>
      </View>
      <Button small title={t('admin.save')} disabled={!ok} onPress={save} />
    </Card>
  );
}
