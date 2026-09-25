import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, CheckRow, Header, LegalDraftNote, Screen, T, goBack, showDemoToast } from '@/components';

export default function Kvkk() {
  const { t } = useTranslation();
  const [c, setC] = useState({ read: false, marketing: false, abroad: false });
  const toggle = (k: keyof typeof c) => setC((s) => ({ ...s, [k]: !s[k] }));
  return (
    <Screen footer={<Button title={t('common.confirm')} disabled={!c.read} onPress={() => { showDemoToast(t('kvkk.saved')); goBack(); }} />}>
      <Header title={t('kvkk.title')} />
      <LegalDraftNote />
      <Card>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ gap: space(1), marginBottom: space(2) }}>
            <T variant="h3">{t(`kvkk.h${i}`)}</T>
            <T color={colors.muted}>{t(`kvkk.b${i}`)}</T>
          </View>
        ))}
      </Card>
      <CheckRow label={t('kvkk.c1')} hint={t('common.required')} checked={c.read} onToggle={() => toggle('read')} />
      <CheckRow label={t('kvkk.c2')} hint={t('common.optional')} checked={c.marketing} onToggle={() => toggle('marketing')} />
      <CheckRow label={t('kvkk.c3')} hint={t('common.optional')} checked={c.abroad} onToggle={() => toggle('abroad')} />
    </Screen>
  );
}
