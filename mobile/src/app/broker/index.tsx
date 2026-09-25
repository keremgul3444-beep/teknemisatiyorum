import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, Chip, Field, Header, Icon, Screen, Section, T } from '@/components';
import { actions, formatPrice, useBoats, useBrokerCases } from '@/services';
import { currentLang } from '@/i18n';
import { requireLevel } from '@/session/role';

export default function Broker() {
  const { t } = useTranslation();
  const boats = useBoats();
  const cases = useBrokerCases();
  const [boat, setBoat] = useState(boats[0]?.name);
  const [asking, setAsking] = useState('');
  const [note, setNote] = useState('');
  const apply = () => {
    if (!requireLevel(2) || !boat) return;
    const id = actions.applyBroker({ boatName: boat, askingEUR: Number(asking) || 0 });
    router.replace(`/broker/${id}`);
  };
  return (
    <Screen footer={<Button title={t('broker.apply')} disabled={!boat || !asking} onPress={apply} />}>
      <Header title={t('broker.title')} subtitle={t('broker.subtitle')} />
      <Card>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space(3), paddingVertical: space(1) }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <T variant="caption" color={colors.white} style={{ fontFamily: 'Inter_700Bold' }}>{i + 1}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="bodySemi">{t(`broker.steps.s${i}`)}</T>
              <T variant="caption" color={colors.muted}>{t(`broker.stepBody.s${i}`)}</T>
            </View>
          </View>
        ))}
        <T variant="caption" color={colors.warning}>{t('broker.commission')}</T>
      </Card>
      {cases.length ? (
        <Section title={t('broker.cases')}>
          {cases.map((c) => (
            <Card key={c.id} onPress={() => router.push(`/broker/${c.id}`)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
                <Icon name="briefcase" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <T variant="h3">{c.boatName}</T>
                  <T variant="caption" color={colors.muted}>{t(`broker.steps.s${c.step}`)}</T>
                </View>
                <Icon name="chevron" size={18} color={colors.muted} />
              </View>
            </Card>
          ))}
        </Section>
      ) : null}
      <Section title={t('broker.boat')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {boats.map((b) => <Chip key={b.id} label={b.name} selected={boat === b.name} onPress={() => setBoat(b.name)} />)}
        </View>
      </Section>
      <Field label={t('broker.asking')} value={asking} onChangeText={(v) => setAsking(v.replace(/\D/g, ''))} keyboardType="numeric"
        placeholder={formatPrice(98000, 'EUR', currentLang())} />
      <Field label={t('broker.note')} value={note} onChangeText={setNote} multiline />
    </Screen>
  );
}
