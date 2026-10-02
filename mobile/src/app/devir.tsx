import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Button, Card, CheckRow, Header, Icon, LegalDraftNote, Screen, T, showDemoToast } from '@/components';
import { actions, useListing } from '@/services';
import { attempt } from '@/services/errors';

/** Adımlar; bağlantısı olanlar resmî siteye gider (Umurbey randevu, e-Devlet). */
const STEPS: { k: string; url?: string }[] = [
  { k: 'docs' }, { k: 'contract' }, { k: 'payment' },
  { k: 'port', url: 'https://umurbey.uab.gov.tr' }, { k: 'register', url: 'https://www.turkiye.gov.tr' },
  { k: 'insurance' }, { k: 'logbook' },
];
const DOCS = ['id', 'license', 'boatPhotos', 'engineSerial', 'photo'] as const;

/**
 * Devir asistanı: ikinci el tekne satışının Türkiye'deki resmî adımları (noter satış sözleşmesi, liman başkanlığı
 * başvurusu, 15 gün içinde e-Devlet tescili) ve belge kontrol listesi. `ilan` verilirse sonunda ilan satıldı olarak işaretlenir.
 */
export default function Devir() {
  const { t } = useTranslation();
  const { ilan } = useLocalSearchParams<{ ilan?: string }>();
  const listing = useListing(ilan);
  const [done, setDone] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>('docs');
  const toggle = (set: typeof setDone) => (k: string) => set((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  const pct = done.length / STEPS.length;
  const markSold = async () => {
    if (!listing) return;
    const ok = await attempt(async () => { await actions.markSold(listing.id); return true; });
    if (ok) { showDemoToast(t('transfer.soldDone')); router.replace('/profil/ilanlarim'); }
  };

  return (
    <Screen footer={listing && listing.status === 'yayinda' ? <Button icon="check" title={t('transfer.markSold')} onPress={markSold} /> : undefined}>
      <Header title={t('transfer.title')} subtitle={listing ? `${listing.brand} ${listing.model}` : t('transfer.subtitle')} />
      <View style={{ gap: space(2) }}>
        <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: colors.primary }} />
        </View>
        <T variant="caption" color={colors.muted}>{t('transfer.progress', { done: done.length, total: STEPS.length })}</T>
      </View>

      {STEPS.map((s, i) => (
        <Card key={s.k}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(3) }}>
            <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: done.includes(s.k) ? colors.success : colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              {done.includes(s.k) ? <Icon name="check" size={16} color={colors.white} /> : <T variant="caption" style={{ fontFamily: fonts.bodyBold }}>{i + 1}</T>}
            </View>
            <View style={{ flex: 1 }}>
              <CheckRow label={t(`transfer.step.${s.k}`)} checked={done.includes(s.k)} onToggle={() => toggle(setDone)(s.k)} />
            </View>
          </View>
          <Pressable onPress={() => setOpen(open === s.k ? null : s.k)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space(1), minHeight: 32 }}>
            <T variant="caption" color={colors.primary} style={{ fontFamily: fonts.bodySemi }}>{t('transfer.what')}</T>
            <Icon name="chevron" size={14} color={colors.primary} />
          </Pressable>
          {open === s.k ? (
            <View style={{ gap: space(2) }}>
              <T variant="caption" color={colors.muted}>{t(`transfer.stepBody.${s.k}`)}</T>
              {s.k === 'docs' ? DOCS.map((d) => <CheckRow key={d} label={t(`transfer.doc.${d}`)} checked={docs.includes(d)} onToggle={() => toggle(setDocs)(d)} />) : null}
              {s.url ? <Button small variant="secondary" icon="globe" title={t(`transfer.link.${s.k}`)} onPress={() => Linking.openURL(s.url!).catch(() => undefined)} /> : null}
            </View>
          ) : null}
        </Card>
      ))}
      <LegalDraftNote />
    </Screen>
  );
}
