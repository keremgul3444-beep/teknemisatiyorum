import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, space } from '@/theme';
import { Button, Card, EmptyState, Field, Header, Icon, Screen, Section, T, showDemoToast } from '@/components';
import { actions, useSavedSearches } from '@/services';
import { requireLevel } from '@/session/role';
import { attempt } from '@/services/errors';

export default function Aramalar() {
  const { t } = useTranslation();
  const searches = useSavedSearches();
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const create = async () => {
    if (!requireLevel(1)) return;
    const ok = await attempt(async () => { await actions.saveSearch(text.trim()); return true; });
    if (!ok) return;
    setText('');
    showDemoToast(t('assistant.saved'));
  };
  return (
    <Screen>
      <Header title={t('saved.title')} />
      <Card>
        <T variant="h3">{t('saved.newRequest')}</T>
        <T variant="caption" color={colors.muted}>{t('saved.requestHint')}</T>
        <Field value={text} onChangeText={setText} placeholder={t('saved.requestPlaceholder')} multiline />
        <Button title={t('saved.create')} disabled={text.trim().length < 3} onPress={create} />
      </Card>
      <Section title={t('saved.title')}>
        {searches.length === 0 ? <EmptyState icon="bell" title={t('saved.empty')} /> : searches.map((s) => (
          <Card key={s.id} onPress={() => {
            void actions.searchSeen(s.id);
            router.push(s.filter ? { pathname: '/ilanlar', params: { q: JSON.stringify(s.filter) } } : { pathname: '/asistan', params: { q: s.query } });
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
              <Icon name="sparkle" size={20} color={colors.primary} />
              <View style={{ flex: 1, gap: space(0.5) }}>
                <T variant="bodySemi">{`“${s.query}”`}</T>
                <T variant="caption" color={colors.muted}>{t('saved.created', { date: s.createdAt })}</T>
              </View>
              <T variant="caption" color={s.newMatches ? colors.primary : colors.muted} style={{ fontFamily: fonts.bodyBold }}>
                {s.newMatches ? t('saved.newMatches', { count: s.newMatches }) : t('saved.noMatches')}
              </T>
              <Pressable accessibilityRole="button" accessibilityLabel={t('saved.delete')} hitSlop={10} onPress={() => setDeleting(s.id)}>
                <Icon name="x" size={18} color={colors.muted} />
              </Pressable>
            </View>
            {deleting === s.id ? (
              <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
                <T variant="caption" style={{ flex: 1 }}>{t('saved.deleteConfirm')}</T>
                <Button small variant="secondary" title={t('common.cancel')} onPress={() => setDeleting(null)} />
                <Button small title={t('saved.delete')} onPress={async () => { await attempt(() => actions.deleteSearch(s.id)); setDeleting(null); }} />
              </View>
            ) : null}
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
