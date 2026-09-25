import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '@/theme';
import {
  BoatImage, Button, CheckRow, Chip, Field, Header, Icon, ListingCard, Screen, Section, Stepper, SuccessView, T, UploadBox,
} from '@/components';
import { actions, type BoatType, type Currency, type Equipment, type Listing } from '@/services';
import { LOCATIONS } from '@/features/assistant/parse';
import { requireLevel } from '@/session/role';

const TYPES: BoatType[] = ['motoryat', 'yelkenli', 'katamaran', 'gulet', 'surat', 'balikci'];
const EQUIP: Equipment[] = ['jenerator', 'branda', 'klima', 'radar', 'otopilot', 'bowThruster', 'teak', 'tender'];
const CURS: Currency[] = ['EUR', 'TRY', 'USD'];
const STEPS = ['photos', 'basics', 'equipment', 'price', 'docs'] as const;

export default function IlanVer() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<number[]>([]);
  const [f, setF] = useState({ brand: '', model: '', year: '', length: '', cabins: '', engine: '', description: '', price: '' });
  const [type, setType] = useState<BoatType | undefined>();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [location, setLocation] = useState<string | undefined>();
  const [broker, setBroker] = useState(false);
  const [doc, setDoc] = useState(false);
  const [preview, setPreview] = useState(false);
  const [done, setDone] = useState(false);
  // Değerleme, karne ya da ilanlarım gibi her giriş noktasında aynı kimlik kapısı geçerli.
  useEffect(() => { requireLevel(2); }, []);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const num = (s: string) => Number(s.replace(',', '.'));

  const valid = [
    photos.length > 0,
    !!(f.brand && f.model && num(f.year) > 1950 && num(f.length) > 2 && type),
    true,
    !!(num(f.price) > 0 && location),
    true,
  ][step];

  const draft = {
    brand: f.brand, model: f.model, year: num(f.year), lengthM: num(f.length), price: num(f.price), currency, type: type ?? 'motoryat',
    location: location ?? '', equipment, cabins: num(f.cabins) || 0, engine: f.engine || '—', description: f.description || '—',
  };
  const previewListing: Listing = { ...draft, id: 'preview', badges: doc ? ['sahiplik'] : [], sellerId: 'me', logbookCount: 0, status: 'onay-bekliyor', photoSeed: photos[0] ?? 0 };

  if (done) {
    return (
      <Screen>
        <Header title="" />
        <SuccessView title={t('wizard.doneTitle')} body={t('wizard.doneBody')} actions={[
          { title: t('wizard.goMine'), onPress: () => router.replace('/profil/ilanlarim') },
          { title: t('wizard.goHome'), onPress: () => router.dismissTo('/kesfet'), variant: 'ghost' },
        ]} />
      </Screen>
    );
  }

  if (preview) {
    return (
      <Screen footer={
        <View style={{ flexDirection: 'row', gap: space(3) }}>
          <View style={{ flex: 1 }}><Button variant="ghost" title={t('common.back')} onPress={() => setPreview(false)} /></View>
          <View style={{ flex: 2 }}><Button title={t('wizard.publish')} onPress={() => {
            if (!requireLevel(2)) return;
            actions.createListing(draft);
            if (broker) actions.applyBroker({ boatName: `${f.brand} ${f.model}`, askingEUR: currency === 'EUR' ? draft.price : 0 });
            setDone(true);
          }} /></View>
        </View>
      }>
        <Header title={t('wizard.preview')} back={false} />
        <ListingCard listing={previewListing} />
      </Screen>
    );
  }

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : setPreview(true));
  return (
    <Screen footer={
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        {step > 0 ? <View style={{ flex: 1 }}><Button variant="ghost" title={t('common.back')} onPress={() => setStep(step - 1)} /></View> : null}
        <View style={{ flex: 2 }}><Button title={step === STEPS.length - 1 ? t('wizard.preview') : t('common.next')} disabled={!valid} onPress={next} /></View>
      </View>
    }>
      <Header title={t('wizard.title')} />
      <Stepper steps={STEPS.map((s) => t(`wizard.steps.${s}`))} current={step} />

      {step === 0 ? (
        <Section title={t('wizard.steps.photos')}>
          <T variant="caption" color={colors.muted}>{t('wizard.photosHint')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Pressable key={i} onPress={() => setPhotos((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
                style={{ width: '31.5%', aspectRatio: 1, borderRadius: radius.button, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                {photos.includes(i) ? (
                  <View style={{ position: 'absolute', inset: 0 }}><BoatImage seed={i + 1} height={200} /></View>
                ) : (
                  <View style={{ alignItems: 'center', gap: space(1) }}>
                    <Icon name="camera" size={22} color={colors.muted} />
                    <T variant="caption" color={colors.muted}>{t('wizard.addPhoto')}</T>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      {step === 1 ? (
        <>
          <Field label={t('wizard.brand')} value={f.brand} onChangeText={set('brand')} placeholder="Beneteau" />
          <Field label={t('wizard.model')} value={f.model} onChangeText={set('model')} placeholder="Oceanis 40" />
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <View style={{ flex: 1 }}><Field label={t('wizard.year')} value={f.year} onChangeText={(v) => set('year')(v.replace(/\D/g, ''))} keyboardType="numeric" maxLength={4} /></View>
            <View style={{ flex: 1 }}><Field label={t('wizard.length')} value={f.length} onChangeText={set('length')} keyboardType="decimal-pad" /></View>
          </View>
          <Section title={t('wizard.type')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
              {TYPES.map((ty) => <Chip key={ty} label={t(`boatType.${ty}`)} selected={type === ty} onPress={() => setType(ty)} />)}
            </View>
          </Section>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <View style={{ flex: 1 }}><Field label={t('wizard.cabins')} value={f.cabins} onChangeText={(v) => set('cabins')(v.replace(/\D/g, ''))} keyboardType="numeric" /></View>
            <View style={{ flex: 2 }}><Field label={t('wizard.engine')} value={f.engine} onChangeText={set('engine')} placeholder="Yanmar 45hp" /></View>
          </View>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <T variant="caption" color={colors.muted}>{t('wizard.equipmentHint')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {EQUIP.map((e) => <Chip key={e} label={t(`equipment.${e}`)} selected={equipment.includes(e)}
              onPress={() => setEquipment((s) => (s.includes(e) ? s.filter((x) => x !== e) : [...s, e]))} />)}
          </View>
          <Field label={t('wizard.description')} value={f.description} onChangeText={set('description')} placeholder={t('wizard.descriptionPh')} multiline />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Field label={t('wizard.price')} value={f.price} onChangeText={(v) => set('price')(v.replace(/\D/g, ''))} keyboardType="numeric" />
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            {CURS.map((c) => <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />)}
          </View>
          <Section title={t('wizard.location')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
              {LOCATIONS.map((l) => <Chip key={l} label={l} selected={location === l} onPress={() => setLocation(l)} />)}
            </View>
          </Section>
          <CheckRow label={t('wizard.broker')} hint={t('wizard.brokerHint')} checked={broker} onToggle={() => setBroker(!broker)} />
        </>
      ) : null}

      {step === 4 ? (
        <Section title={t('wizard.docsTitle')}>
          <T variant="caption" color={colors.muted}>{t('wizard.docsHint')}</T>
          <UploadBox label={t('wizard.docLabel')} state={doc ? 'incelemede' : 'bos'} onPress={() => setDoc(true)} />
        </Section>
      ) : null}
    </Screen>
  );
}
