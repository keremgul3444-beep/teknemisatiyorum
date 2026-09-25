import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '@/theme';
import { BoatImage, Button, Chip, Field, Header, Icon, Screen, Section, T } from '@/components';
import { actions, USTA_CATEGORIES, useBoats, type UstaCategory } from '@/services';
import { requireLevel } from '@/session/role';

export default function IsYeni() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ kategori?: string; baslik?: string }>();
  const boats = useBoats();
  const [boatId, setBoatId] = useState(boats[0]?.id);
  const [cat, setCat] = useState<UstaCategory | undefined>(USTA_CATEGORIES.includes(params.kategori as UstaCategory) ? (params.kategori as UstaCategory) : undefined);
  const [title, setTitle] = useState(params.baslik ?? '');
  const [desc, setDesc] = useState('');
  const [photos, setPhotos] = useState(0);
  const [when, setWhen] = useState<'urgent' | 'thisWeek' | 'flexible'>('thisWeek');
  const valid = boatId && cat && title.trim().length > 2;

  const send = () => {
    if (!requireLevel(1) || !boatId || !cat) return;
    const id = actions.createJob({ category: cat, title: title.trim(), description: desc.trim(), boatId });
    router.replace(`/is/${id}`);
  };

  return (
    <Screen footer={<Button title={t('job.send')} disabled={!valid} onPress={send} />}>
      <Header title={t('job.newTitle')} />
      <Section title={t('job.boat')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(3) }}>
          {boats.map((b) => (
            <Pressable key={b.id} onPress={() => setBoatId(b.id)}
              style={{ width: 150, borderRadius: radius.button, overflow: 'hidden', borderWidth: 2, borderColor: boatId === b.id ? colors.primary : colors.line, backgroundColor: colors.card }}>
              <BoatImage seed={b.photoSeed} height={70} />
              <View style={{ padding: space(2) }}>
                <T variant="bodySemi" numberOfLines={1}>{b.name}</T>
                <T variant="caption" color={colors.muted} numberOfLines={1}>{b.brand} {b.model}</T>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </Section>
      <Section title={t('job.category')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {USTA_CATEGORIES.map((c) => <Chip key={c} label={t(`usta.cat.${c}`)} selected={cat === c} onPress={() => setCat(c)} />)}
        </View>
      </Section>
      <Field label={t('job.titleLabel')} value={title} onChangeText={setTitle} placeholder={t('job.titlePh')} />
      <Field label={t('job.description')} value={desc} onChangeText={setDesc} placeholder={t('job.descriptionPh')} multiline />
      <Section title={t('job.photos')}>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Pressable key={i} onPress={() => setPhotos(Math.max(photos, i + 1))}
              style={{ flex: 1, aspectRatio: 1, borderRadius: radius.button, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              {i < photos ? <View style={{ position: 'absolute', inset: 0 }}><BoatImage seed={i + 3} height={100} /></View> : <Icon name="camera" size={20} color={colors.muted} />}
            </Pressable>
          ))}
        </View>
      </Section>
      <Section title={t('job.when')}>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          {(['urgent', 'thisWeek', 'flexible'] as const).map((w) => <Chip key={w} label={t(`job.${w}`)} selected={when === w} onPress={() => setWhen(w)} />)}
        </View>
      </Section>
    </Screen>
  );
}
