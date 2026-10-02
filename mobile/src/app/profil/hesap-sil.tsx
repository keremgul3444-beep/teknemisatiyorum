import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme';
import { Button, Card, Field, Header, LegalDraftNote, Screen, T } from '@/components';
import { actions, isApiMode } from '@/services';
import { useSession } from '@/session/role';
import { attempt } from '@/services/errors';

export default function HesapSil() {
  const { t } = useTranslation();
  const [word, setWord] = useState('');
  const ok = word.trim().toLocaleUpperCase('tr-TR') === t('deleteAcc.word');
  const del = async () => {
    const ok = await attempt(async () => { await actions.deleteAccount(); return true; });
    if (!ok) return;
    if (!isApiMode()) await actions.resetDemo();
    useSession.setState({ onboarded: false });
    router.dismissAll();
    router.replace('/onboarding');
  };
  return (
    <Screen footer={<Button variant="danger" icon="trash" title={t('deleteAcc.confirm')} disabled={!ok} onPress={del} />}>
      <Header title={t('deleteAcc.title')} />
      <Card><T color={colors.muted}>{t('deleteAcc.body')}</T></Card>
      <LegalDraftNote />
      <Field label={t('deleteAcc.type')} value={word} onChangeText={setWord} placeholder={t('deleteAcc.word')} />
    </Screen>
  );
}
