import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import {
  BoatImage, Button, CheckRow, Chip, Field, Header, Icon, ListingCard, Screen, Section, Stepper, SuccessView, T, UploadBox,
} from '@/components';
import { actions, type BoatType, type Currency, type Equipment, type Listing } from '@/services';
import { FLAGS, LOCATIONS, MAX_ENGINE_HOURS } from '@tms/shared';
import { requireLevel, useSession } from '@/session/role';
import { isApiMode } from '@/services';
import { attempt } from '@/services/errors';
import { pickImage, pickImages } from '@/services/pickImage';
import {
  MAX_LISTING_PHOTOS, WIZARD_STEPS, addPhotos, digitsOnly, emptyWizard, groupThousands, makeCover, movePhoto, removePhoto,
  toDraft, validateStep, type StepErrors, type WizardFields, type WizardState,
} from '@/features/listingForm';
import { clearListingDraft, loadListingDraft, saveListingDraft } from '@/features/listingDraftStore';

const TYPES: BoatType[] = ['motoryat', 'yelkenli', 'katamaran', 'gulet', 'surat', 'balikci'];
const EQUIP: Equipment[] = ['jenerator', 'branda', 'klima', 'radar', 'otopilot', 'bowThruster', 'teak', 'tender'];
const CURS: Currency[] = ['EUR', 'TRY', 'USD'];

let photoCounter = 0;
const newPhotoId = () => `p${Date.now().toString(36)}${(photoCounter++).toString(36)}`;

export default function IlanVer() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const userId = useSession((x) => x.userId);
  const [s, setS] = useState<WizardState>(emptyWizard);
  const [loaded, setLoaded] = useState(false);
  const [restored, setRestored] = useState<null | { photosLost: boolean }>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [preview, setPreview] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const seedRef = useRef(1);

  // Değerleme, karne ya da ilanlarım gibi her giriş noktasında aynı kimlik kapısı geçerli.
  useEffect(() => { requireLevel(2); }, []);

  // Yarım kalan ilan bu cihazdan geri yüklenir; sonra her değişiklik kısa bir gecikmeyle kaydedilir.
  useEffect(() => {
    let alive = true;
    loadListingDraft(userId).then((d) => {
      if (!alive) return;
      if (d) {
        setS(d);
        setRestored({ photosLost: d.photos.length === 0 });
        seedRef.current = d.photos.reduce((m, p) => Math.max(m, p.seed + 1), 1);
      }
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [userId]);
  useEffect(() => {
    if (!loaded || done) return;
    const h = setTimeout(() => { void saveListingDraft(userId, s); }, 400);
    return () => clearTimeout(h);
  }, [s, loaded, done, userId]);

  const update = (patch: Partial<WizardState>) => setS((cur) => ({ ...cur, ...patch }));
  const set = (k: keyof WizardFields) => (v: string) => setS((cur) => ({ ...cur, f: { ...cur.f, [k]: v } }));
  const step = s.step;
  const errors: StepErrors = validateStep(step, s);
  const err = (k: keyof StepErrors) => (showErrors && errors[k] ? t(errors[k]!) : undefined);

  const discardDraft = async () => {
    await clearListingDraft(userId);
    setS(emptyWizard());
    setRestored(null);
    setShowErrors(false);
    setSelected(null);
  };

  const addMore = async () => {
    const room = MAX_LISTING_PHOTOS - s.photos.length;
    if (room <= 0) return;
    if (isApiMode()) {
      const uris = await pickImages(room);
      if (!uris.length) return;
      setS((cur) => ({ ...cur, photos: addPhotos(cur.photos, uris.map((uri) => ({ uri, seed: seedRef.current++ })), newPhotoId) }));
    } else {
      setS((cur) => ({ ...cur, photos: addPhotos(cur.photos, [{ seed: seedRef.current++ }], newPhotoId) }));
    }
    setRestored((r) => (r ? { photosLost: false } : r));
  };

  const draft = toDraft(s);
  const previewListing: Listing = {
    ...draft, id: 'preview', badges: s.doc ? ['sahiplik'] : [], sellerId: 'me', logbookCount: 0, status: 'onay-bekliyor',
    photoSeed: s.photos[0]?.seed ?? 0, photoUrls: s.photos.map((p) => p.uri).filter((u): u is string => !!u),
  };

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
          <View style={{ flex: 2 }}><Button title={t('wizard.publish')} loading={busy} onPress={async () => {
            if (!requireLevel(2)) return;
            setBusy(true);
            const id = await attempt(() => actions.createListing(draft, {
              photoUris: s.photos.map((p) => p.uri).filter((u): u is string => !!u), broker: s.broker,
              ownershipUri: s.docUri ?? undefined, engineDocUri: s.engineDocUri ?? undefined, engineSerialLast4: s.engineSerial.trim() || undefined,
            }));
            setBusy(false);
            if (id) {
              await clearListingDraft(userId);
              setDone(true);
            }
          }} /></View>
        </View>
      }>
        <Header title={t('wizard.preview')} back={false} />
        <ListingCard listing={previewListing} disabled />
      </Screen>
    );
  }

  const hasErrors = Object.keys(errors).length > 0;
  const next = () => {
    if (hasErrors) { setShowErrors(true); return; }
    setShowErrors(false);
    setSelected(null);
    setRestored(null);
    if (step < WIZARD_STEPS.length - 1) update({ step: step + 1 });
    else setPreview(true);
  };
  const sel = s.photos.findIndex((p) => p.id === selected);
  const row = { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) } as const;

  return (
    <Screen footer={
      <View style={{ gap: space(2) }}>
        {showErrors && hasErrors ? <T variant="caption" color={colors.danger} style={{ textAlign: 'center' }}>{t('wizard.err.fix')}</T> : null}
        <View style={{ flexDirection: 'row', gap: space(3) }}>
          {step > 0 ? <View style={{ flex: 1 }}><Button variant="ghost" title={t('common.back')} onPress={() => { setShowErrors(false); update({ step: step - 1 }); }} /></View> : null}
          <View style={{ flex: 2 }}><Button title={step === WIZARD_STEPS.length - 1 ? t('wizard.preview') : t('common.next')} disabled={!loaded} onPress={next} /></View>
        </View>
      </View>
    }>
      <Header title={t('wizard.title')} />
      <Stepper steps={WIZARD_STEPS.map((x) => t(`wizard.steps.${x}`))} current={step} />

      {restored ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.button, padding: space(3), gap: space(1.5) }}>
          <T variant="caption">{t('wizard.draftRestored')}{restored.photosLost ? ` ${t('wizard.draftPhotosLost')}` : ''}</T>
          <Pressable onPress={discardDraft} accessibilityRole="button" hitSlop={8}>
            <T variant="caption" color={colors.primary} style={{ fontFamily: fonts.bodyBold }}>{t('wizard.draftDiscard')}</T>
          </Pressable>
        </View>
      ) : null}

      {step === 0 ? (
        <Section title={t('wizard.steps.photos')}>
          <T variant="caption" color={colors.muted}>{t('wizard.photosHint')} {t('wizard.photosHint2')}</T>
          <T variant="caption" color={colors.primary} style={{ fontFamily: fonts.bodyBold }}>{t('wizard.photosCount', { count: s.photos.length, max: MAX_LISTING_PHOTOS })}</T>
          <View style={row}>
            {s.photos.map((p, i) => (
              <Pressable key={p.id} onPress={() => { setSelected(selected === p.id ? null : p.id); setConfirmRemove(false); }}
                accessibilityRole="button" accessibilityLabel={t('wizard.photoLabel', { n: i + 1 })} accessibilityState={{ selected: selected === p.id }}
                style={{ width: '31.5%', aspectRatio: 1, borderRadius: radius.button, overflow: 'hidden', borderWidth: selected === p.id ? 3 : 0, borderColor: colors.primary }}>
                <View style={{ position: 'absolute', inset: 0 }}><BoatImage seed={p.seed} height={200} uri={p.uri} /></View>
                {i === 0 ? (
                  <View style={{ position: 'absolute', left: space(1.5), top: space(1.5), backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: space(0.5) }}>
                    <T variant="caption" color={colors.white} style={{ fontFamily: fonts.bodyBold }}>{t('wizard.cover')}</T>
                  </View>
                ) : null}
              </Pressable>
            ))}
            {s.photos.length < MAX_LISTING_PHOTOS ? (
              <Pressable onPress={addMore} accessibilityRole="button"
                style={{ width: '31.5%', aspectRatio: 1, borderRadius: radius.button, borderWidth: 1.5, borderStyle: 'dashed', borderColor: err('photos') ? colors.danger : colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ alignItems: 'center', gap: space(1) }}>
                  <Icon name="camera" size={22} color={colors.muted} />
                  <T variant="caption" color={colors.muted}>{t('wizard.addPhoto')}</T>
                </View>
              </Pressable>
            ) : null}
          </View>
          {err('photos') ? <T variant="caption" color={colors.danger}>{err('photos')}</T> : null}
          {sel >= 0 ? (
            confirmRemove ? (
              <View style={{ gap: space(2) }}>
                <T variant="caption">{t('wizard.removeConfirm')}</T>
                <View style={{ flexDirection: 'row', gap: space(2) }}>
                  <View style={{ flex: 1 }}><Button small variant="secondary" title={t('common.cancel')} onPress={() => setConfirmRemove(false)} /></View>
                  <View style={{ flex: 1 }}><Button small variant="danger" title={t('wizard.removePhoto')} onPress={() => {
                    update({ photos: removePhoto(s.photos, selected!) });
                    setSelected(null);
                    setConfirmRemove(false);
                  }} /></View>
                </View>
              </View>
            ) : (
              <View style={row}>
                {sel > 0 ? <Chip label={t('wizard.makeCover')} onPress={() => update({ photos: makeCover(s.photos, selected!) })} /> : null}
                {sel > 0 ? <Chip label={t('wizard.moveLeft')} onPress={() => update({ photos: movePhoto(s.photos, selected!, -1) })} /> : null}
                {sel < s.photos.length - 1 ? <Chip label={t('wizard.moveRight')} onPress={() => update({ photos: movePhoto(s.photos, selected!, 1) })} /> : null}
                <Chip label={t('wizard.removePhoto')} tone="warning" onPress={() => setConfirmRemove(true)} />
              </View>
            )
          ) : null}
        </Section>
      ) : null}

      {step === 1 ? (
        <>
          <T variant="caption" color={colors.muted}>{t('wizard.requiredNote')}</T>
          <Field label={t('wizard.brand')} required value={s.f.brand} onChangeText={set('brand')} placeholder={t('wizard.brandPh')} error={err('brand')} maxLength={60} />
          <Field label={t('wizard.model')} required value={s.f.model} onChangeText={set('model')} placeholder={t('wizard.modelPh')} error={err('model')} maxLength={60} />
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <View style={{ flex: 1 }}><Field label={t('wizard.year')} required value={s.f.year} onChangeText={(v) => set('year')(digitsOnly(v))} keyboardType="numeric" maxLength={4} placeholder={t('wizard.yearPh')} error={err('year')} /></View>
            <View style={{ flex: 1 }}><Field label={t('wizard.length')} required value={s.f.length} onChangeText={(v) => set('length')(v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" maxLength={6} placeholder={t('wizard.lengthPh')} error={err('length')} /></View>
          </View>
          <Section title={`${t('wizard.type')} *`}>
            <View style={row}>
              {TYPES.map((ty) => <Chip key={ty} label={t(`boatType.${ty}`)} selected={s.type === ty} onPress={() => update({ type: ty })} />)}
            </View>
            {err('type') ? <T variant="caption" color={colors.danger}>{err('type')}</T> : null}
          </Section>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <View style={{ flex: 1 }}><Field label={t('wizard.cabins')} value={s.f.cabins} onChangeText={(v) => set('cabins')(digitsOnly(v))} keyboardType="numeric" maxLength={2} /></View>
            <View style={{ flex: 2 }}><Field label={t('wizard.engine')} value={s.f.engine} onChangeText={set('engine')} placeholder={t('wizard.enginePh')} maxLength={80} /></View>
          </View>
          <Field label={t('wizard.engineHours')} value={s.f.engineHours} onChangeText={(v) => set('engineHours')(digitsOnly(v))} keyboardType="numeric"
            maxLength={String(MAX_ENGINE_HOURS).length} hint={t('wizard.engineHoursHint')} error={err('engineHours')} />
          <Section title={t('wizard.flag')}>
            <View style={row}>
              {FLAGS.map((fl) => <Chip key={fl} label={t(fl === 'tr' ? 'wizard.flagTr' : 'wizard.flagForeign')} selected={s.flag === fl}
                onPress={() => update({ flag: s.flag === fl ? undefined : fl })} />)}
            </View>
          </Section>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <T variant="caption" color={colors.muted}>{t('wizard.equipmentHint')}</T>
          <View style={row}>
            {EQUIP.map((e) => <Chip key={e} label={t(`equipment.${e}`)} selected={s.equipment.includes(e)}
              onPress={() => update({ equipment: s.equipment.includes(e) ? s.equipment.filter((x) => x !== e) : [...s.equipment, e] })} />)}
          </View>
          <Field label={t('wizard.description')} value={s.f.description} onChangeText={set('description')} placeholder={t('wizard.descriptionPh')} multiline maxLength={4000} />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <T variant="caption" color={colors.muted}>{t('wizard.requiredNote')}</T>
          <Field label={t('wizard.price')} required value={groupThousands(s.f.price, lang)} onChangeText={(v) => set('price')(digitsOnly(v).slice(0, 10))}
            keyboardType="numeric" placeholder={t('wizard.pricePh')} error={err('price')} />
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            {CURS.map((c) => <Chip key={c} label={c} selected={s.currency === c} onPress={() => update({ currency: c })} />)}
          </View>
          <CheckRow label={t('wizard.negotiable')} checked={s.negotiable} onToggle={() => update({ negotiable: !s.negotiable })} />
          <CheckRow label={t('wizard.tradeIn')} checked={s.tradeIn} onToggle={() => update({ tradeIn: !s.tradeIn })} />
          <Section title={`${t('wizard.location')} *`}>
            <View style={row}>
              {LOCATIONS.map((l) => <Chip key={l} label={l} selected={s.location === l} onPress={() => update({ location: l })} />)}
            </View>
            {err('location') ? <T variant="caption" color={colors.danger}>{err('location')}</T> : null}
          </Section>
          <CheckRow label={t('wizard.broker')} hint={t('wizard.brokerHint')} checked={s.broker} onToggle={() => update({ broker: !s.broker })} />
        </>
      ) : null}

      {step === 4 ? (
        <Section title={t('wizard.docsTitle')}>
          <T variant="caption" color={colors.muted}>{t('wizard.docsHint')}</T>
          <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.button, padding: space(3) }}>
            <Icon name="lock" size={18} color={colors.primary} />
            <T variant="caption" style={{ flex: 1 }}>{t('wizard.docsPrivacy')}</T>
          </View>
          <UploadBox label={t('wizard.docLabel')} state={s.doc ? 'incelemede' : 'bos'} onPress={async () => {
            if (isApiMode()) {
              const uri = await pickImage();
              if (!uri) return;
              update({ docUri: uri });
            }
            update({ doc: true });
          }} />
          <UploadBox label={t('wizard.engineDocLabel')} state={s.engineDoc ? 'incelemede' : 'bos'} onPress={async () => {
            if (isApiMode()) {
              const uri = await pickImage();
              if (!uri) return;
              update({ engineDocUri: uri });
            }
            update({ engineDoc: true });
          }} />
          {s.engineDoc ? (
            <>
              <Field label={t('wizard.engineSerial')} value={s.engineSerial} onChangeText={(v) => update({ engineSerial: v.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() })} maxLength={6} />
              <T variant="caption" color={colors.muted}>{t('wizard.engineSerialHint')}</T>
            </>
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}
