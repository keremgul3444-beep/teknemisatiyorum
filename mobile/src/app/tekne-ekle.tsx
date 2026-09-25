import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { space } from '@/theme';
import { Button, Field, Header, Screen } from '@/components';
import { actions } from '@/services';

export default function TekneEkle() {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: '', brand: '', model: '', year: '', length: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name && f.brand && f.model && Number(f.year) > 1950 && Number(f.length.replace(',', '.')) > 2;
  const save = () => {
    const id = actions.addBoat({ name: f.name, brand: f.brand, model: f.model, year: Number(f.year), lengthM: Number(f.length.replace(',', '.')) });
    router.replace(`/teknelerim/${id}`);
  };
  return (
    <Screen footer={<Button title={t('boatAdd.save')} disabled={!valid} onPress={save} />}>
      <Header title={t('boatAdd.title')} />
      <Field label={t('boatAdd.name')} value={f.name} onChangeText={set('name')} placeholder={t('boatAdd.namePh')} />
      <Field label={t('wizard.brand')} value={f.brand} onChangeText={set('brand')} />
      <Field label={t('wizard.model')} value={f.model} onChangeText={set('model')} />
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <View style={{ flex: 1 }}><Field label={t('wizard.year')} value={f.year} onChangeText={(v) => set('year')(v.replace(/\D/g, ''))} keyboardType="numeric" maxLength={4} /></View>
        <View style={{ flex: 1 }}><Field label={t('wizard.length')} value={f.length} onChangeText={set('length')} keyboardType="decimal-pad" /></View>
      </View>
    </Screen>
  );
}
