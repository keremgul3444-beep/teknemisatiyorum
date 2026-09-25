import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, space, fonts } from '@/theme';
import type { Listing } from '@/services';
import { T } from './T';

// Türkiye batı ve güney kıyısında şehirlerin kutu içindeki yaklaşık konumu (yüzde).
const CITY_POS: Record<string, [number, number]> = {
  'İstanbul': [30, 10], 'Çeşme': [8, 42], 'Didim': [18, 58], 'Bodrum': [22, 66], 'Marmaris': [34, 74],
  'Göcek': [44, 78], 'Fethiye': [48, 82], 'Kaş': [58, 88], 'Antalya': [74, 80],
};

export function MapPreview({ listings, selected, onSelect }: { listings: Listing[]; selected?: string; onSelect: (city?: string) => void }) {
  const counts = listings.reduce<Record<string, number>>((m, l) => ({ ...m, [l.location]: (m[l.location] ?? 0) + 1 }), {});
  return (
    <View style={{ height: 380, borderRadius: radius.card, backgroundColor: colors.surface, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute' }}>
        <Path d="M0 0 L100 0 L100 70 L82 76 L70 74 L60 84 L50 78 L40 74 L32 70 L26 62 L20 54 L14 46 L10 36 L18 26 L26 16 L36 8 L30 0 Z"
          fill={colors.card} opacity={0.9} />
      </Svg>
      {Object.entries(CITY_POS).map(([city, [x, y]]) => {
        const n = counts[city] ?? 0;
        if (!n) return null;
        const on = selected === city;
        return (
          <Pressable key={city} onPress={() => onSelect(on ? undefined : city)}
            style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: [{ translateX: -20 }, { translateY: -14 }], alignItems: 'center' }}>
            <View style={{ backgroundColor: on ? colors.text : colors.primary, borderRadius: 14, paddingHorizontal: space(2.5), paddingVertical: space(1) }}>
              <T variant="caption" color={colors.white} style={{ fontFamily: fonts.bodyBold }}>{n}</T>
            </View>
            <T variant="caption" style={{ fontFamily: fonts.bodySemi, fontSize: 10 }}>{city}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
