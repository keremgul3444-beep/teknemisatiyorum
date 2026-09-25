import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Avatar, Button, Card, Header, Icon, NotFound, Screen, Section, Stepper, T } from '@/components';
import { actions, BROKER_CONTACT, formatPrice, useBrokerCase } from '@/services';
import { currentLang } from '@/i18n';

export default function BrokerCase() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useBrokerCase(id);
  if (!c) return <NotFound />;
  const steps = [0, 1, 2, 3, 4];
  const write = () => {
    const conv = actions.startConversation({ kind: 'broker', id: c.id, title: `${t('broker.caseTitle')} · ${c.boatName}` }, BROKER_CONTACT.name);
    router.push(`/sohbet/${conv}`);
  };
  return (
    <Screen>
      <Header title={c.boatName} subtitle={t('broker.asked', { price: formatPrice(c.askingEUR, 'EUR', currentLang()) })} />
      <Stepper steps={steps.map((s) => t(`broker.steps.s${s}`))} current={c.step} />
      <Card>
        {steps.map((s) => {
          const state = s < c.step ? 'done' : s === c.step ? 'now' : 'next';
          return (
            <View key={s} style={{ flexDirection: 'row', gap: space(3), paddingVertical: space(1.5), opacity: state === 'next' ? 0.55 : 1 }}>
              <Icon name={state === 'done' ? 'check' : state === 'now' ? 'sparkle' : 'calendar'} size={20}
                color={state === 'done' ? colors.success : state === 'now' ? colors.primary : colors.muted} />
              <View style={{ flex: 1 }}>
                <T variant="bodySemi">{t(`broker.steps.s${s}`)}</T>
                <T variant="caption" color={colors.muted}>{t(`broker.stepBody.s${s}`)}</T>
              </View>
              <T variant="caption" color={state === 'now' ? colors.primary : colors.muted}>{t(`broker.status.${state}`)}</T>
            </View>
          );
        })}
      </Card>
      <Section title={t('broker.assigned')}>
        <Card>
          <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
            <Avatar name={BROKER_CONTACT.name} />
            <T variant="h3" style={{ flex: 1 }}>{BROKER_CONTACT.name} · {BROKER_CONTACT.company}</T>
          </View>
          <Button variant="ghost" icon="mail" title={t('broker.write')} onPress={write} />
        </Card>
      </Section>
    </Screen>
  );
}
