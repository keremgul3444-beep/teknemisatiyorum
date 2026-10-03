import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { attempt } from '@/services/errors';
import { Button } from './Button';
import { Field } from './Field';
import { T } from './T';

/**
 * Emanetteki ödeme için "Sorun bildir": not yazılır, gönderilince otomatik aktarım durur ve karar ekibe geçer.
 * Bildirilmişse yalnızca durum gösterilir.
 */
export function DisputeBox({ disputed, onSubmit }: { disputed?: boolean; onSubmit: (note: string) => Promise<unknown> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (disputed) return <T variant="caption" color={colors.warning}>{t('dispute.sent')}</T>;
  if (!open) return <Button small variant="ghost" icon="info" title={t('dispute.open')} onPress={() => setOpen(true)} />;
  return (
    <View style={{ gap: space(2) }}>
      <Field label={t('dispute.note')} required value={note} onChangeText={setNote} multiline maxLength={500} hint={t('dispute.hint')} />
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <View style={{ flex: 1 }}><Button small variant="secondary" title={t('common.cancel')} onPress={() => setOpen(false)} /></View>
        <View style={{ flex: 1 }}><Button small variant="danger" title={t('dispute.send')} loading={busy} disabled={note.trim().length < 5}
          onPress={async () => { setBusy(true); await attempt(() => onSubmit(note.trim())); setBusy(false); setOpen(false); }} /></View>
      </View>
    </View>
  );
}
