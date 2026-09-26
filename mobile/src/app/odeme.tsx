import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Button, Card, Field, Header, Icon, NotFound, Screen, Section, T, showDemoToast } from '@/components';
import { actions, formatPrice, useCaptainBookings, useJob, type Currency } from '@/services';
import { currentLang } from '@/i18n';
import { demoOnly } from '@/components/DemoOnly';

function Odeme() {
  const { t } = useTranslation();
  const { tur, id } = useLocalSearchParams<{ tur?: 'is' | 'kaptan'; id?: string }>();
  const job = useJob(tur === 'is' ? id : undefined);
  const booking = useCaptainBookings().find((b) => b.id === id);
  const [card, setCard] = useState({ no: '', exp: '', cvc: '' });
  const [loading, setLoading] = useState(false);

  const offer = job?.offers.find((o) => o.id === job.acceptedOfferId);
  const base: { amount: number; cur: Currency } | null =
    tur === 'is' && offer ? { amount: offer.priceTRY, cur: 'TRY' } : tur === 'kaptan' && booking ? { amount: booking.totalEUR, cur: 'EUR' } : null;
  if (!base) return <NotFound />;
  const lang = currentLang();
  const fee = Math.round(base.amount * 0.08);
  const total = base.amount + fee;
  const valid = card.no.replace(/\D/g, '').length >= 16 && card.exp.length >= 4 && card.cvc.length >= 3;

  const pay = () => {
    setLoading(true);
    setTimeout(() => {
      if (tur === 'is' && job) actions.payJob(job.id);
      if (tur === 'kaptan' && booking) actions.payCaptain(booking.id);
      showDemoToast(t('payment.success'));
      if (tur === 'is' && job) router.dismissTo(`/is/${job.id}`);
      else router.replace('/profil/odemeler');
    }, 1500);
  };

  return (
    <Screen footer={<Button icon="lock" loading={loading} disabled={!valid} title={t('payment.pay', { amount: formatPrice(total, base.cur, lang) })} onPress={pay} />}>
      <Header title={t('payment.title')} />
      <Card>
        {[[t('payment.service'), base.amount], [t('payment.fee'), fee]].map(([k, v]) => (
          <View key={String(k)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T color={colors.muted}>{k}</T><T>{formatPrice(Number(v), base.cur, lang)}</T>
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="h3">{t('payment.total')}</T><T variant="h3" color={colors.primary}>{formatPrice(total, base.cur, lang)}</T>
        </View>
      </Card>

      <Card style={{ backgroundColor: colors.surface }}>
        {(['g1', 'g2', 'g3'] as const).map((g, i) => (
          <View key={g} style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
            <View style={{ width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <T variant="caption" color={colors.white} style={{ fontFamily: fonts.bodyBold }}>{i + 1}</T>
            </View>
            <T style={{ flex: 1 }}>{t(`payment.${g}`)}</T>
          </View>
        ))}
      </Card>

      <Section title={t('payment.card')}>
        <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
          <Icon name="info" size={16} color={colors.warning} />
          <T variant="caption" color={colors.warning}>{t('payment.demo')}</T>
        </View>
        <Field label={t('payment.cardNo')} value={card.no} keyboardType="number-pad" maxLength={19} placeholder="4242 4242 4242 4242"
          onChangeText={(v) => setCard((s) => ({ ...s, no: v.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ') }))} />
        <View style={{ flexDirection: 'row', gap: space(3) }}>
          <View style={{ flex: 1 }}><Field label={t('payment.expiry')} value={card.exp} placeholder="12/28" maxLength={5} keyboardType="number-pad"
            onChangeText={(v) => setCard((s) => ({ ...s, exp: v }))} /></View>
          <View style={{ flex: 1 }}><Field label={t('payment.cvc')} value={card.cvc} placeholder="123" maxLength={4} keyboardType="number-pad"
            onChangeText={(v) => setCard((s) => ({ ...s, cvc: v.replace(/\D/g, '') }))} /></View>
        </View>
      </Section>
    </Screen>
  );
}

export default demoOnly(Odeme);
