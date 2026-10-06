import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, EmptyState, Header, Loading, PreinfoAccept, Screen, showDemoToast, T } from '@/components';
import { actions } from '@/services';
import type { ApiProduct } from '@/services/api/mappers';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';
import { currentLang } from '@/i18n';
import { formatKurus } from '@/features/promo';

/** İlanını öne çıkar: Vitrin / Acil / Üste taşı. Bu turda mağaza ödemesi deneme modunda; demo modunda ürün listesi boş. */
export default function OneCikar() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const remoteProducts = useRemote(() => actions.products());
  const products = remoteProducts.data ?? [];
  const [accepted, setAccepted] = useState(false);
  const buy = (p: ApiProduct) => attempt(async () => {
    await actions.buyInApp(id, p);
    showDemoToast(t('promo.bought'));
    router.back();
  });
  return (
    <Screen>
      <Header title={t('promo.title')} />
      <T color={colors.muted}>{t('promo.intro')}</T>
      {remoteProducts.loading ? <Loading /> : products.length === 0 ? <EmptyState icon="sparkle" title={t('promo.noProducts')} /> : <PreinfoAccept checked={accepted} onToggle={() => setAccepted((v) => !v)} />}
      {products.map((p) => (
        <Card key={p.code}>
          <T variant="h3">{t(`promo.product.${p.code}`, { defaultValue: p.code })}</T>
          <T variant="caption" color={colors.muted}>{t(`promo.kindHint.${p.kind}`)}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(2) }}>
            <View>
              <T variant="h2">{formatKurus(p.priceAppKurus, currentLang())}</T>
              {p.isTrialPrice ? <T variant="caption" color={colors.warning}>{t('promo.trialPrice')}</T> : null}
            </View>
            <Button small disabled={!accepted} title={t('promo.buyDev')} onPress={() => buy(p)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
