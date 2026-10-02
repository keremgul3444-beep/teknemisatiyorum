import { View } from 'react-native';
import { create } from 'zustand';
import { t } from 'i18next';
import { colors, radius, space } from '@/theme';
import { T } from './T';

const useToast = create<{ msg: string | null }>(() => ({ msg: null }));
let timer: ReturnType<typeof setTimeout> | undefined;

export function showDemoToast(message?: string) {
  useToast.setState({ msg: message ?? t('demo.simulated') });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => useToast.setState({ msg: null }), 2200);
}

export function DemoToastHost() {
  const msg = useToast((s) => s.msg);
  if (!msg) return null;
  return (
    <View style={{ pointerEvents: "none", position: "absolute", left: space(5), right: space(5), bottom: 100, alignItems: 'center' }}>
      <View style={{ backgroundColor: colors.text, borderRadius: radius.button, paddingVertical: space(3), paddingHorizontal: space(4) }}>
        <T variant="bodySemi" color={colors.white} style={{ textAlign: 'center' }}>{msg}</T>
      </View>
    </View>
  );
}
