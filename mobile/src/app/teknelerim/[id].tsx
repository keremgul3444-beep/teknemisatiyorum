import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { BoatImage, Button, Card, Header, Icon, NotFound, Screen, Section, T, showDemoToast } from '@/components';
import { useBoat, type LogKind } from '@/services';
import { tx } from '@/i18n';

const KIND_ICON: Record<LogKind, string> = { bakim: 'wrench', onarim: 'settings', ekspertiz: 'clipboard', sahiplik: 'doc' };

export default function Karne() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const b = useBoat(id);
  if (!b) return <NotFound />;
  const n = b.logbook.length;
  const verified = b.logbook.filter((e) => e.verified).length;
  const pct = n ? Math.round((verified / n) * 100) : 0;
  const score = Math.round(Math.min(100, 50 + n * 8) * (0.6 + 0.4 * (pct / 100)));
  const entries = [...b.logbook].sort((a, c) => c.date.localeCompare(a.date));
  const docs = [
    { label: t('logbook.docRuhsat'), date: '2029-05-12', soon: false },
    { label: t('logbook.docInsurance'), date: '2026-10-20', soon: true },
  ];

  return (
    <Screen>
      <Header title={t('logbook.title')} subtitle={`${b.name} · ${b.brand} ${b.model}`} />
      <Card padded={false}>
        <BoatImage seed={b.photoSeed} height={130} />
        <View style={{ padding: space(4), flexDirection: 'row', alignItems: 'center', gap: space(4) }}>
          <View style={{ width: 70, height: 70, borderRadius: radius.pill, borderWidth: 5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <T variant="h2">{score}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="label" color={colors.muted}>{t('logbook.score').toLocaleUpperCase('tr-TR')}</T>
            <T variant="caption" color={colors.muted}>{t('logbook.entries', { count: n, pct })}</T>
          </View>
        </View>
      </Card>

      <Section title={t('logbook.timeline')}>
        <View style={{ paddingLeft: space(2) }}>
          {entries.map((e, i) => (
            <View key={e.id} style={{ flexDirection: 'row', gap: space(3) }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: radius.pill, backgroundColor: e.verified ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={KIND_ICON[e.kind]} size={16} color={e.verified ? colors.white : colors.muted} />
                </View>
                {i < entries.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: colors.line, minHeight: 24 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: space(4), gap: space(0.5) }}>
                <T variant="caption" color={colors.muted}>{e.date} · {t(`logbook.kind.${e.kind}`)}</T>
                <T variant="bodySemi">{tx(t, e.title)}</T>
                <T variant="caption" color={colors.muted}>{tx(t, e.by)}</T>
                <T variant="caption" color={e.verified ? colors.success : colors.muted} style={{ fontFamily: fonts.bodySemi }}>
                  {e.verified ? `✓ ${t('logbook.verified')}` : t('logbook.selfReported')}
                </T>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t('logbook.docs')}>
        <Card>
          {docs.map((d) => (
            <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(1.5) }}>
              <Icon name="doc" size={18} color={d.soon ? colors.warning : colors.primary} />
              <T style={{ flex: 1 }}>{d.label}</T>
              <View style={{ alignItems: 'flex-end' }}>
                <T variant="caption" color={colors.muted}>{t('logbook.expires', { date: d.date })}</T>
                {d.soon ? <T variant="caption" color={colors.warning} style={{ fontFamily: fonts.bodyBold }}>{t('logbook.expiringSoon')}</T> : null}
              </View>
            </View>
          ))}
        </Card>
      </Section>

      <View style={{ gap: space(2) }}>
        <Button icon="share" variant="ghost" title={t('logbook.share')} onPress={() => showDemoToast(t('demo.linkCopied'))} />
        <Button icon="wrench" variant="ghost" title={t('logbook.addService')} onPress={() => router.push('/is/yeni')} />
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <View style={{ flex: 1 }}><Button variant="secondary" title={t('logbook.transfer')} onPress={() => router.push('/devir')} /></View>
          <View style={{ flex: 1 }}><Button title={t('logbook.sell')} onPress={() => router.push('/ilan-ver')} /></View>
        </View>
      </View>
    </Screen>
  );
}
