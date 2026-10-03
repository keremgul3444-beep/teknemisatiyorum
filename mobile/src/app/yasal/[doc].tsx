import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Card, Header, LegalDraftNote, NotFound, Screen, T } from '@/components';

const DOCS = ['preinfo', 'distanceSale'] as const;

/** Yasal metin: ön bilgilendirme formu ya da mesafeli satış sözleşmesi (bölümler `legal.<belge>.h1/b1…`). */
export default function Yasal() {
  const { t, i18n } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  if (!DOCS.includes(doc as (typeof DOCS)[number])) return <NotFound />;
  const sections = Array.from({ length: 12 }, (_, i) => i + 1).filter((i) => i18n.exists(`legal.${doc}.h${i}`));
  return (
    <Screen>
      <Header title={t(`legal.${doc}.title`)} />
      <LegalDraftNote />
      <T color={colors.muted}>{t(`legal.${doc}.description`)}</T>
      <Card>
        {sections.map((i) => (
          <View key={i} style={{ gap: space(1), marginBottom: space(2) }}>
            <T variant="h3">{t(`legal.${doc}.h${i}`)}</T>
            <T color={colors.muted}>{t(`legal.${doc}.b${i}`)}</T>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
