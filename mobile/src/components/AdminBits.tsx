import { ReactNode, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { colors, fonts, radius, space } from '@/theme';
import { formatPrice, type AdminItem, type AdminListingInfo, type AdminStatus, type RejectReason } from '@/services';
import { currentLang } from '@/i18n';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { T } from './T';
import { Icon } from './Icon';

export function AdminPage({ children }: { children: ReactNode }) {
  return <ScrollView contentContainerStyle={{ padding: space(4), gap: space(3), paddingBottom: space(12) }}>{children}</ScrollView>;
}

export function StatusPill({ status }: { status: AdminStatus }) {
  const { t } = useTranslation();
  const bg = status === 'onaylandi' ? colors.success : status === 'reddedildi' ? colors.danger : colors.warning;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: space(0.5), alignSelf: 'flex-start' }}>
      <T variant="caption" color={colors.white} style={{ fontFamily: fonts.bodyBold }}>{t(`admin.status.${status}`)}</T>
    </View>
  );
}

/** Moderatörün onaydan önce gördüğü ilan içeriği: yayına çıkacak her alan, açıklamanın tamamı, satıcının doğrulama seviyesi. */
function ListingFacts({ info: x }: { info: AdminListingInfo }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const rows: [string, string][] = [
    [t('listing.year'), String(x.year)],
    [t('wizard.price'), `${formatPrice(x.price, x.currency, lang)}${x.negotiable ? ` · ${t('listing.negotiable')}` : ''}${x.tradeIn ? ` · ${t('listing.tradeIn')}` : ''}`],
    [t('listing.length'), `${x.lengthM.toLocaleString(lang)} m · ${t(`boatType.${x.type}`)}`],
    [t('listing.location'), x.location],
    [t('listing.cabins'), String(x.cabins)],
    ...(x.engine ? [[t('listing.engine'), x.engine] as [string, string]] : []),
    ...(x.engineHours != null ? [[t('listing.engineHours'), t('listing.engineHoursValue', { hours: x.engineHours.toLocaleString(lang) })] as [string, string]] : []),
    ...(x.flag ? [[t('listing.flag'), t(x.flag === 'tr' ? 'listing.flagTr' : 'listing.flagForeign')] as [string, string]] : []),
    ...(x.equipment.length ? [[t('listing.equipment'), x.equipment.map((e) => t(`equipment.${e}`)).join(', ')] as [string, string]] : []),
    [t('admin.sellerLevel'), t(x.ownerVerifyLevel >= 2 ? 'admin.sellerVerified' : 'admin.sellerUnverified')],
  ];
  return (
    <View style={{ gap: space(1) }}>
      {rows.map(([k, v]) => <T key={k} variant="caption"><T variant="caption" color={colors.muted}>{k}: </T>{v}</T>)}
      <T variant="caption" color={colors.muted}>{t('listing.description')}:</T>
      <T variant="caption">{x.description || '—'}</T>
    </View>
  );
}

/** Onay kuyruğu satırı: onayla ya da gerekçe seçerek reddet. */
export function ApprovalRow({ item, onDecide, onOpenFile }: { item: AdminItem; onDecide: (s: AdminStatus, reason?: RejectReason) => void; onOpenFile?: (fileId: string) => void }) {
  const { t } = useTranslation();
  const [rejecting, setRejecting] = useState(false);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(2) }}>
        <View style={{ flex: 1 }}>
          <T variant="h3">{item.title}</T>
          <T variant="caption" color={colors.muted}>{t('admin.by', { who: item.who })}</T>
        </View>
        <StatusPill status={item.status} />
      </View>
      {item.photos?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          {item.photos.map((u) => <Image key={u} source={{ uri: u }} style={{ width: 96, height: 72, borderRadius: radius.sm }} />)}
        </ScrollView>
      ) : null}
      {item.listing ? <ListingFacts info={item.listing} /> : null}
      {(item.listing?.photoDuplicates ?? []).map((d) => (
        <Pressable key={d.listingId} onPress={() => router.push(`/ilan/${d.listingId}`)} accessibilityRole="link"
          style={{ flexDirection: 'row', gap: space(1.5), alignItems: 'center' }}>
          <Icon name="info" size={14} color={d.sameOwner ? colors.warning : colors.danger} />
          <T variant="caption" color={d.sameOwner ? colors.warning : colors.danger} style={{ flex: 1 }}>
            {t(d.sameOwner ? 'admin.duplicateSame' : 'admin.duplicateOther', { title: d.title })}
          </T>
        </Pressable>
      ))}
      {item.listing?.previousRejectReason ? (
        <T variant="caption" color={colors.danger}>{t('admin.previousReject')}: {t(`admin.reasons.${item.listing.previousRejectReason}`, { defaultValue: item.listing.previousRejectReason })}</T>
      ) : null}
      {item.details ? (
        <View style={{ gap: space(0.5) }}>
          {Object.entries(item.details).map(([k, v]) => (
            <T key={k} variant="caption" color={colors.muted}>{t(`admin.detail.${k}`, { defaultValue: k })}: {String(v)}</T>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {item.kind === 'ilan' && item.refId && item.photos ? (
          <Pressable onPress={() => router.push(`/ilan/${item.refId}`)}><T variant="caption" color={colors.primary}>{t('admin.openListing')} →</T></Pressable>
        ) : null}
        {(item.fileIds ?? []).map((f, i) => (
          <Pressable key={f} onPress={() => onOpenFile?.(f)}><T variant="caption" color={colors.primary}>{t('admin.openDoc', { n: i + 1 })} →</T></Pressable>
        ))}
      </View>
      {item.status === 'bekliyor' ? (
        rejecting ? (
          <View style={{ gap: space(2) }}>
            <T variant="caption" color={colors.muted}>{t('admin.rejectReason')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
              {(['blurry', 'mismatch', 'rules'] as const).map((r) => <Chip key={r} label={t(`admin.reasons.${r}`)} onPress={() => onDecide('reddedildi', r)} />)}
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <View style={{ flex: 1 }}><Button small variant="ghost" title={t('admin.reject')} onPress={() => setRejecting(true)} /></View>
            <View style={{ flex: 1 }}><Button small title={t('admin.approve')} onPress={() => onDecide('onaylandi')} /></View>
          </View>
        )
      ) : null}
    </Card>
  );
}
