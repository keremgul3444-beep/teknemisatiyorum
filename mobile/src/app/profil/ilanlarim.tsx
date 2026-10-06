import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, EmptyState, Field, Header, Icon, ListingCard, Screen, Segmented, T } from '@/components';
import { actions, formatPrice, isApiMode, useListings, type Listing, type ListingStatus } from '@/services';
import { attempt } from '@/services/errors';
import { digitsOnly, groupThousands } from '@/features/listingForm';
import { currentLang } from '@/i18n';
import { priceNeedsReview } from '@tms/shared';
import { daysLeft } from '@/features/promo';

export default function Ilanlarim() {
  const { t } = useTranslation();
  // Sunucuda yarım kalmış taslaklar (yayın tamamlanmadı) burada gösterilmez; ilan verme ekranından sürdürülür.
  const mine = useListings().filter((l) => (l.sellerId === 'me' || l.isMine) && l.rawStatus !== 'draft');
  // Önce satıcının ilgilenmesi gereken durum açılır: reddedilen, sonra onay bekleyen.
  const [tab, setTab] = useState<ListingStatus>(mine.some((l) => l.status === 'reddedildi') ? 'reddedildi'
    : mine.some((l) => l.status === 'suresi-doldu') ? 'suresi-doldu'
    : mine.some((l) => l.status === 'onay-bekliyor') ? 'onay-bekliyor' : 'yayinda');
  const list = mine.filter((l) => l.status === tab);
  return (
    <Screen>
      <Header title={t('profile.listings')} />
      <Segmented value={tab} onChange={setTab} options={[
        { key: 'yayinda', label: t('mine.live') }, { key: 'onay-bekliyor', label: t('mine.pending') },
        ...(mine.some((l) => l.status === 'reddedildi') ? [{ key: 'reddedildi' as const, label: t('mine.rejected') }] : []),
        ...(mine.some((l) => l.status === 'kaldirildi') ? [{ key: 'kaldirildi' as const, label: t('mine.removed') }] : []),
        ...(mine.some((l) => l.status === 'suresi-doldu') ? [{ key: 'suresi-doldu' as const, label: t('mine.expired') }] : []),
        { key: 'satildi', label: t('mine.sold') },
      ]} />
      {list.length === 0 ? <EmptyState icon="anchor" title={t('mine.empty')} actionLabel={t('mine.post')} onAction={() => router.push('/ilan-ver')} />
        : list.map((l) => (
          <View key={l.id} style={{ gap: space(2) }}>
            <ListingCard listing={l} />
            {l.status === 'reddedildi' ? <T variant="caption" color={colors.danger}>{t(`mine.rejectReasons.${l.rejectReason ?? 'rules'}`)}</T> : null}
            {l.status === 'reddedildi' && l.rejectNote ? <T variant="caption">{t('mine.rejectNote', { note: l.rejectNote })}</T> : null}
            {l.pendingEdit ? <T variant="caption" color={colors.warning}>{t('mine.pendingEdit')}</T> : null}
            {l.status === 'yayinda' && !l.pendingEdit && l.rejectReason ? <T variant="caption" color={colors.danger}>{t('mine.editRejected')} {t(`mine.rejectReasons.${l.rejectReason}`)}{l.rejectNote ? ` · ${l.rejectNote}` : ''}</T> : null}
            {l.status === 'kaldirildi' && l.removedReason ? <T variant="caption" color={colors.danger}>{t(`mine.removedReasons.${l.removedReason}`)}</T> : null}
            {l.status === 'suresi-doldu' || (l.status === 'yayinda' && expiringIn(l) !== null) ? <RenewRow listing={l} /> : null}
            {l.stats ? <StatsRow stats={l.stats} /> : null}
            {l.status === 'yayinda' && isApiMode() ? <PromoRow listing={l} /> : null}
            {l.status === 'yayinda' || l.status === 'onay-bekliyor' || l.status === 'reddedildi' || l.status === 'suresi-doldu' ? <ManageRow listing={l} /> : null}
          </View>
        ))}
    </Screen>
  );
}

/**
 * İlan yönetimi: düzenle (sihirbaz düzenleme modu), yalnızca fiyat (onaya düşmez), yayından kaldır.
 * Geri alınamayan kaldırma aynı satırda ikinci adımla onaylanır.
 */
function ManageRow({ listing: l }: { listing: Listing }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<null | 'price' | 'withdraw'>(null);
  const [price, setPrice] = useState(String(Math.round(l.price)));
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await attempt(fn);
    setBusy(false);
    setMode(null);
  };
  if (mode === 'price') {
    const n = Number(digitsOnly(price));
    return (
      <View style={{ gap: space(2) }}>
        <Field label={`${t('wizard.price')} (${l.currency})`} value={groupThousands(price, currentLang())} onChangeText={(v) => setPrice(digitsOnly(v).slice(0, 10))}
          keyboardType="numeric" hint={l.status === 'yayinda' ? t(n > 0 && priceNeedsReview(l.price, n) ? 'mine.priceReviewHint' : 'mine.priceHint') : undefined} />
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <View style={{ flex: 1 }}><Button small variant="secondary" title={t('common.cancel')} onPress={() => setMode(null)} /></View>
          <View style={{ flex: 1 }}><Button small title={t('mine.priceSave')} loading={busy} disabled={!(n > 0) || n === Math.round(l.price)}
            onPress={() => run(() => actions.updateListing(l.id, { price: n }))} /></View>
        </View>
      </View>
    );
  }
  if (mode === 'withdraw') {
    return (
      <View style={{ gap: space(2) }}>
        <T variant="caption">{t('mine.withdrawConfirm', { title: `${l.brand} ${l.model}` })}</T>
        {l.promo?.featured || l.promo?.urgent ? <T variant="caption" color={colors.warning}>{t('mine.promoWarn')}</T> : null}
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <View style={{ flex: 1 }}><Button small variant="secondary" title={t('common.cancel')} onPress={() => setMode(null)} /></View>
          <View style={{ flex: 1 }}><Button small variant="danger" title={t('mine.withdraw')} loading={busy} onPress={() => run(() => actions.withdrawListing(l.id))} /></View>
        </View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
      <Button small variant={l.status === 'reddedildi' ? 'primary' : 'secondary'} icon="doc" title={t(l.status === 'reddedildi' ? 'mine.fix' : 'mine.edit')}
        onPress={() => router.push({ pathname: '/ilan-ver', params: { id: l.id } })} />
      {l.status === 'yayinda' ? (
        <Button small variant="ghost" title={`${t('mine.price')} · ${formatPrice(l.price, l.currency, currentLang())}`} onPress={() => setMode('price')} />
      ) : null}
      <Button small variant="ghost" icon="x" title={t('mine.withdraw')} onPress={() => setMode('withdraw')} />
    </View>
  );
}

/** Yayının bitmesine kalan gün; yalnızca yenileme penceresinde (14 gün) sayı, değilse null. */
function expiringIn(l: Listing, now = Date.now()): number | null {
  if (!l.expiresAt) return null;
  const d = Math.ceil((new Date(l.expiresAt).getTime() - now) / 864e5);
  return d <= 14 ? Math.max(d, 0) : null;
}

/** Süresi dolan ya da dolmak üzere olan ilan: tek dokunuşla 90 gün yenileme (onaya düşmez). */
function RenewRow({ listing: l }: { listing: Listing }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const left = expiringIn(l);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
      <T variant="caption" color={colors.warning} style={{ flex: 1 }}>
        {l.status === 'suresi-doldu' ? t('mine.expiredNote') : t('mine.expiresIn', { n: left })}
      </T>
      <Button small icon="check" title={t('mine.renew')} loading={busy}
        onPress={async () => { setBusy(true); await attempt(() => actions.renewListing(l.id)); setBusy(false); }} />
    </View>
  );
}

/** Satıcı istatistikleri: görüntülenme, favori, mesaj. */
function StatsRow({ stats }: { stats: NonNullable<Listing['stats']> }) {
  const { t } = useTranslation();
  const items: [string, string][] = [['eye', t('mine.views', { n: stats.views })], ['heart', t('mine.favorites', { n: stats.favorites })], ['mail', t('mine.messages', { n: stats.messages })]];
  return (
    <View style={{ flexDirection: 'row', gap: space(4), flexWrap: 'wrap' }}>
      {items.map(([icon, label]) => (
        <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
          <Icon name={icon} size={16} color={colors.muted} />
          <T variant="caption" color={colors.muted}>{label}</T>
        </View>
      ))}
    </View>
  );
}

/** Yayındaki ilanın öne çıkarma durumu (kalan gün) ve öne çıkarma düğmesi. */
function PromoRow({ listing: l }: { listing: Listing }) {
  const { t } = useTranslation();
  const f = daysLeft(l.promo?.featuredUntil);
  const u = daysLeft(l.promo?.urgentUntil);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) }}>
      <View style={{ flex: 1 }}>
        {f ? <T variant="caption" color={colors.primary}>{t('promo.activeFeatured', { n: f })}</T> : null}
        {u ? <T variant="caption" color={colors.danger}>{t('promo.activeUrgent', { n: u })}</T> : null}
      </View>
      <Button small variant="ghost" icon="doc" title={t('mine.transfer')} onPress={() => router.push({ pathname: '/devir', params: { ilan: l.id } })} />
      <Button small variant="secondary" icon="sparkle" title={t('promo.cta')} onPress={() => router.push(`/profil/one-cikar/${l.id}`)} />
    </View>
  );
}
