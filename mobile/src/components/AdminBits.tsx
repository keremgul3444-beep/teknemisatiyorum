import { ReactNode, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { colors, fonts, radius, space } from '@/theme';
import type { AdminItem, AdminStatus } from '@/services';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { T } from './T';

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

/** Onay kuyruğu satırı: onayla ya da gerekçe seçerek reddet. */
export function ApprovalRow({ item, onDecide, onOpenFile }: { item: AdminItem; onDecide: (s: AdminStatus) => void; onOpenFile?: (fileId: string) => void }) {
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
              {(['blurry', 'mismatch', 'rules'] as const).map((r) => <Chip key={r} label={t(`admin.reasons.${r}`)} onPress={() => onDecide('reddedildi')} />)}
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
