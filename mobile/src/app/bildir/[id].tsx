import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, CheckRow, Field, Header, NotFound, Screen, SuccessView, T } from '@/components';
import { actions, useListing, type ReportReason } from '@/services';
import { REPORT_REASONS } from '@tms/shared';
import { requireLevel } from '@/session/role';
import { attempt } from '@/services/errors';

/** İlanı bildir: gerekçe seç, istersen not ekle. Bildirim satıcıya gösterilmez; moderatör inceler. */
export default function Bildir() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const l = useListing(id);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!l) return <NotFound />;

  if (done) {
    return (
      <Screen>
        <Header title="" />
        <SuccessView title={t('report.doneTitle')} body={t('report.doneBody')} actions={[{ title: t('common.back'), onPress: () => router.back() }]} />
      </Screen>
    );
  }

  const send = async () => {
    if (!reason || !requireLevel(1)) return;
    setBusy(true);
    const r = await attempt(() => actions.reportListing(l.id, reason, note.trim()));
    setBusy(false);
    if (r) setDone(true);
  };

  return (
    <Screen footer={<Button title={t('report.send')} icon="shield" disabled={!reason} loading={busy} onPress={send} />}>
      <Header title={t('report.title')} subtitle={`${l.brand} ${l.model} · ${l.year}`} />
      <T color={colors.muted}>{t('report.body')}</T>
      <View accessibilityRole="radiogroup" style={{ gap: space(1) }}>
        {REPORT_REASONS.map((r) => (
          <CheckRow key={r} label={t(`report.reasons.${r}`)} checked={reason === r} onToggle={() => setReason(r)} />
        ))}
      </View>
      <Field label={t('report.note')} value={note} onChangeText={setNote} placeholder={t('report.notePh')} multiline maxLength={500} />
    </Screen>
  );
}
