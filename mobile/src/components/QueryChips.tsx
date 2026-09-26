import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { space } from '@/theme';
import { currentLang } from '@/i18n';
import { queryChips } from '@tms/shared';
import type { ParsedQuery } from '@tms/shared';
import { Chip } from './Chip';

export function QueryChips({ query }: { query: ParsedQuery }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
      {queryChips(query, t, currentLang()).map((c) => <Chip key={c} label={c} selected />)}
    </View>
  );
}
