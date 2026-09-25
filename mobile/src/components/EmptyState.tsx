import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { T } from './T';
import { Button } from './Button';
import { Icon } from './Icon';
import { Screen } from './Screen';
import { goBack } from './Header';

export function EmptyState({ title, body, actionLabel, onAction, icon = 'anchor' }: { title: string; body?: string; actionLabel?: string; onAction?: () => void; icon?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: space(8), gap: space(3) }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color={colors.primary} />
      </View>
      <T variant="h3" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T color={colors.muted} style={{ textAlign: 'center' }}>{body}</T> : null}
      {actionLabel ? <Button title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState icon="search" title={t('common.notFound')} body={t('common.notFoundBody')} actionLabel={t('common.goBack')} onAction={goBack} />
    </Screen>
  );
}
