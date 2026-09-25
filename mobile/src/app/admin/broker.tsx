import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { AdminPage, Button, Card, Stepper, T } from '@/components';
import { actions, formatPrice, useBrokerCases } from '@/services';
import { currentLang } from '@/i18n';

export default function AdminBroker() {
  const { t } = useTranslation();
  const cases = useBrokerCases();
  return (
    <AdminPage>
      {cases.map((c) => (
        <Card key={c.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="h3">{c.boatName}</T>
            <T color={colors.primary}>{formatPrice(c.askingEUR, 'EUR', currentLang())}</T>
          </View>
          <Stepper steps={[0, 1, 2, 3, 4].map((s) => t(`broker.steps.s${s}`))} current={c.step} />
          <View style={{ marginTop: space(1) }}>
            <Button small variant="secondary" title={t('admin.advance')} disabled={c.step >= 4} onPress={() => actions.advanceBroker(c.id)} />
          </View>
        </Card>
      ))}
    </AdminPage>
  );
}
