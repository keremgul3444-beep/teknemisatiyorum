import { ReactNode } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { gradients, colors } from '@/theme';

export function BoatImage({ seed, height = 160, rounded = 0, children }: { seed: number; height?: number; rounded?: number; children?: ReactNode }) {
  const g = gradients[Math.abs(seed) % gradients.length];
  const w = Math.min(170, height * 1.1);
  return (
    <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height, borderRadius: rounded, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', bottom: height * 0.12, left: 0, right: 0, alignItems: 'center' }}>
        <Svg width={w} height={w * 0.3} viewBox="0 0 170 50">
          <Path d="M5 30 L165 30 L148 46 L22 46 Z" fill={colors.white} opacity={0.92} />
          <Path d="M45 30 L60 14 L120 14 L132 30 Z" fill={colors.white} opacity={0.75} />
        </Svg>
      </View>
      {children}
    </LinearGradient>
  );
}
