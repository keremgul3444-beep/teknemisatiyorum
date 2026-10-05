import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, CheckRow, Chip, Field, Header, Screen, SuccessView, T, goBack } from '@/components';
import { actions } from '@/services';
import { attempt } from '@/services/errors';
import { requireLevel } from '@/session/role';

const KINDS = ['finance', 'insurance', 'transport'] as const;

/** Finansman / sigorta / nakliye teklifi: açık izinle talep; ekip anlaşmalı iş ortağına iletir, iş ortağı arar. */
export default function Teklif() {
  const { t } = useTranslation();
  const { ilan } = useLocalSearchParams<{ ilan?: string }>();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('finance');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <Screen><SuccessView title={t('lead.sentTitle')} body={t('lead.sent')} actions={[{ title: t('common.back'), onPress: goBack }]} /></Screen>;
  const send = async () => {
    if (!requireLevel(1)) return;
    setBusy(true);
    const r = await attempt(() => actions.requestLead({ kind, listingId: ilan, note }));
    setBusy(false);
    if (r !== undefined) setDone(true);
  };
  return (
    <Screen footer={<Button title={t('lead.send')} loading={busy} disabled={!consent} onPress={() => void send()} />}>
      <Header title={t('lead.title')} />
      <T color={colors.muted}>{t('lead.intro')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {KINDS.map((k) => <Chip key={k} label={t(`lead.${k}`)} selected={kind === k} onPress={() => setKind(k)} />)}
      </View>
      <Field label={t('lead.note')} value={note} onChangeText={setNote} multiline maxLength={500} />
      <CheckRow label={t('lead.consent')} hint={t('common.required')} checked={consent} onToggle={() => setConsent((v) => !v)} />
    </Screen>
  );
}
