import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '@/theme';
import { T } from './T';
import { Icon } from './Icon';

export type UploadState = 'bos' | 'incelemede' | 'yuklendi';

export function UploadBox({ label, state, onPress }: { label: string; state: UploadState; onPress: () => void }) {
  const { t } = useTranslation();
  const done = state !== 'bos';
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3.5), borderRadius: radius.button,
      borderWidth: 1.5, borderStyle: done ? 'solid' : 'dashed', borderColor: done ? colors.primary : colors.line, backgroundColor: colors.card }}>
      <Icon name={done ? 'check' : 'doc'} size={20} color={done ? colors.primary : colors.muted} />
      <T style={{ flex: 1 }}>{label}</T>
      <View style={{ backgroundColor: done ? colors.surface : colors.primary, borderRadius: radius.sm, paddingHorizontal: space(2.5), paddingVertical: space(1) }}>
        <T variant="caption" color={done ? colors.warning : colors.white} style={{ fontFamily: 'Inter_700Bold' }}>
          {state === 'bos' ? t('common.upload') : state === 'incelemede' ? t('common.inReview') : t('common.uploaded')}
        </T>
      </View>
    </Pressable>
  );
}
