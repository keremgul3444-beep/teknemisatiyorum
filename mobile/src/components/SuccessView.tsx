import { View } from 'react-native';
import { colors, radius, space } from '@/theme';
import { T } from './T';
import { Icon } from './Icon';
import { Button } from './Button';

export function SuccessView({ title, body, actions }: { title: string; body?: string; actions: { title: string; onPress: () => void; variant?: 'primary' | 'ghost' }[] }) {
  return (
    <View style={{ alignItems: 'center', gap: space(4), paddingVertical: space(10) }}>
      <View style={{ width: 84, height: 84, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={40} color={colors.white} />
      </View>
      <T variant="h2" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T color={colors.muted} style={{ textAlign: 'center' }}>{body}</T> : null}
      <View style={{ alignSelf: 'stretch', gap: space(2), marginTop: space(4) }}>
        {actions.map((a) => <Button key={a.title} title={a.title} onPress={a.onPress} variant={a.variant ?? 'primary'} />)}
      </View>
    </View>
  );
}
