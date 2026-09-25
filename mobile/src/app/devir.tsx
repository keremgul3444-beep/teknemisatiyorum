import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Card, CheckRow, Header, LegalDraftNote, Screen, T } from '@/components';

const STEPS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;

export default function Devir() {
  const { t } = useTranslation();
  const [done, setDone] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const pct = done.length / STEPS.length;
  return (
    <Screen>
      <Header title={t('transfer.title')} subtitle={t('transfer.subtitle')} />
      <View style={{ gap: space(2) }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: colors.primary }} />
        </View>
        <T variant="caption" color={colors.muted}>{t('transfer.progress', { done: done.length, total: STEPS.length })}</T>
      </View>
      {STEPS.map((s) => (
        <Card key={s}>
          <CheckRow label={t(`transfer.${s}`)} checked={done.includes(s)} onToggle={() => setDone((d) => (d.includes(s) ? d.filter((x) => x !== s) : [...d, s]))} />
          <Pressable onPress={() => setOpen(open === s ? null : s)}>
            <T variant="caption" color={colors.primary}>{t('transfer.what')} {open === s ? '▴' : '▾'}</T>
          </Pressable>
          {open === s ? <T variant="caption" color={colors.muted}>{t(`transfer.${s}b`)}</T> : null}
        </Card>
      ))}
      <LegalDraftNote />
    </Screen>
  );
}
