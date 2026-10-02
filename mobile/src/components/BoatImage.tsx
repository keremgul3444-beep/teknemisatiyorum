import { ReactNode } from 'react';
import { Image, View } from 'react-native';
import { colors } from '@/theme';
import { boatPhoto } from '@/assets/boatPhotos';

/**
 * İlan/tekne görseli: sunucudan gelen fotoğraf (uri) varsa o; yoksa demo için MINOA'nın gerçek tekne
 * çekimlerinden biri. seed ilanı seçer; frame galerideki kareyi seçer (0 dış çekim, sonrakiler iç mekân).
 */
export function BoatImage({ seed, frame = 0, height = 160, rounded = 0, children, uri }: {
  seed: number; frame?: number; height?: number; rounded?: number; children?: ReactNode; uri?: string;
}) {
  return (
    <View style={{ height, borderRadius: rounded, overflow: 'hidden', backgroundColor: colors.surface }}>
      {/* Paketlenmiş görselde RN kendi boyutunu varsayar; genişlik/yükseklik açıkça verilir ki kutuyu doldurup ortadan kırpsın. */}
      <Image source={uri ? { uri } : boatPhoto(seed, frame)} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
      {children}
    </View>
  );
}
