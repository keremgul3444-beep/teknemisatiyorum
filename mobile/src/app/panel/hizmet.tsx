import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Button, Card, Field, Header, Icon, Screen, Section, StatusLine, T, showDemoToast } from '@/components';
import { currentLang } from '@/i18n';
import { demoOnly } from '@/components/DemoOnly';

const REQS = ['req1', 'req2', 'req3'] as const;
const WEEK = [true, false, true, true, false, false, true];

function HizmetPaneli() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('');
  const wd = new Intl.DateTimeFormat(currentLang() === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short' });
  const today = new Date();

  return (
    <Screen>
      <Header title={t('panel.title')} />
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        {[[t('panel.earnings'), '₺48.600'], [t('panel.pendingOffers'), String(REQS.length - sent.length)], [t('panel.rating'), '4.9']].map(([k, v]) => (
          <Card key={k} style={{ flex: 1 }}>
            <T variant="caption" color={colors.muted}>{k}</T>
            <T variant="h2" color={colors.primary}>{v}</T>
          </Card>
        ))}
      </View>

      <Section title={t('panel.incoming')}>
        {REQS.map((r) => (
          <Card key={r}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
              <Icon name="wrench" size={18} color={colors.primary} />
              <T style={{ flex: 1 }}>{t(`panel.${r}`)}</T>
              {sent.includes(r) ? <StatusLine text={t('panel.sent')} />
                : <Button small title={t('panel.giveOffer')} onPress={() => setOpen(open === r ? null : r)} />}
            </View>
            {open === r ? (
              <View style={{ gap: space(2) }}>
                <View style={{ flexDirection: 'row', gap: space(2) }}>
                  <View style={{ flex: 1 }}><Field label={t('panel.price')} value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, ''))} keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Field label={t('panel.days')} value={days} onChangeText={(v) => setDays(v.replace(/\D/g, ''))} keyboardType="numeric" /></View>
                </View>
                <Button small title={t('panel.send')} disabled={!price || !days} onPress={() => {
                  setSent((s) => [...s, r]); setOpen(null); setPrice(''); setDays(''); showDemoToast(t('panel.sent'));
                }} />
              </View>
            ) : null}
          </Card>
        ))}
      </Section>

      <Section title={t('panel.calendar')}>
        <View style={{ flexDirection: 'row', gap: space(1.5) }}>
          {WEEK.map((busy, i) => {
            const d = new Date(today); d.setDate(today.getDate() + i);
            return (
              <View key={i} style={{ flex: 1, borderRadius: radius.sm, padding: space(2), alignItems: 'center', backgroundColor: busy ? colors.primary : colors.card, borderWidth: 1, borderColor: colors.line }}>
                <T variant="caption" color={busy ? colors.white : colors.muted} style={{ fontSize: 10 }}>{wd.format(d)}</T>
                <T variant="caption" color={busy ? colors.white : colors.text} style={{ fontFamily: fonts.bodyBold }}>{d.getDate()}</T>
                <T variant="caption" color={busy ? colors.white : colors.muted} style={{ fontSize: 9 }}>{busy ? t('panel.busy') : t('panel.free')}</T>
              </View>
            );
          })}
        </View>
      </Section>

      <Section title={t('panel.myDocs')}>
        <Card>
          {[{ name: t('verify.doc.vergi'), days: 420 }, { name: t('verify.doc.ustalik'), days: 20 }].map((d) => (
            <View key={d.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(1.5) }}>
              <Icon name="doc" size={18} color={d.days < 30 ? colors.warning : colors.success} />
              <View style={{ flex: 1 }}>
                <T>{d.name}</T>
                <T variant="caption" color={d.days < 30 ? colors.warning : colors.muted}>{t('panel.expiresIn', { days: d.days })}</T>
              </View>
              {d.days < 30 ? <Button small variant="secondary" title={t('panel.renew')} onPress={() => showDemoToast()} /> : null}
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

export default demoOnly(HizmetPaneli);
