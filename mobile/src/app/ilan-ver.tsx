import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import {
  BoatImage, Button, CheckRow, Chip, Field, Header, Icon, ListingCard, NotFound, Screen, Section, Stepper, SuccessView, T, UploadBox,
} from '@/components';
import { actions, useListing, type BoatType, type Currency, type Equipment, type Listing } from '@/services';
import { FLAGS, LOCATIONS, MAX_ENGINE_HOURS, priceNeedsReview } from '@tms/shared';
import { requireLevel, useSession } from '@/session/role';
import { isApiMode } from '@/services';
import { attempt } from '@/services/errors';
import { pickImage, pickImages } from '@/services/pickImage';
import {
  MAX_LISTING_PHOTOS, WIZARD_STEPS, addPhotos, digitsOnly, draftChanges, dropMissingFiles, emptyWizard, firstInvalidStep, fromListing,
  describeFacts, groupThousands, makeCover, movePhoto, photosChanged, removePhoto, toDraft, validateStep, type StepErrors, type WizardFields, type WizardState,
} from '@/features/listingForm';
import { clearListingDraft, loadListingDraft, saveListingDraft } from '@/features/listingDraftStore';
import { clearDraftFiles, draftFileExists, keepDraftFile } from '@/features/draftFiles';

const TYPES: BoatType[] = ['motoryat', 'yelkenli', 'katamaran', 'gulet', 'surat', 'balikci'];
const EQUIP: Equipment[] = ['jenerator', 'branda', 'klima', 'radar', 'otopilot', 'bowThruster', 'teak', 'tender'];
const CURS: Currency[] = ['EUR', 'TRY', 'USD'];

let photoCounter = 0;
const newPhotoId = () => `p${Date.now().toString(36)}${(photoCounter++).toString(36)}`;

export default function IlanVer() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const userId = useSession((x) => x.userId);
  const verifyLevel = useSession((x) => x.verifyLevel);
  // Düzenleme modu: /ilan-ver?id=… mevcut ilanı açar; yerel taslak kullanılmaz, belge adımı yoktur.
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const editing = useListing(editId);
  const isEdit = !!editId;
  const [s, setS] = useState<WizardState>(() => (editing ? fromListing(editing, i18n.language) : emptyWizard()));
  // Düzenlemenin başladığı hâl: değişen alanlar buna göre bulunur.
  const [origin] = useState(() => (editing ? fromListing(editing, i18n.language) : null));
  const steps = isEdit ? WIZARD_STEPS.slice(0, 4) : WIZARD_STEPS;
  const [doneKind, setDoneKind] = useState<'created' | 'price' | 'review' | 'none'>('created');
  // Taslağı yüklenmiş hesap; hesap değişince yükleme bitene kadar kayıt yapılmaz (boş form başka hesabın taslağını silmesin).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const draftKey = userId ?? 'demo';
  const loaded = isEdit || loadedFor === draftKey;
  const [restored, setRestored] = useState<null | { lostPhotos: number; noPhotos: boolean }>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [preview, setPreview] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const seedRef = useRef(1);
  const loadedOnce = useRef(false);

  // Değerleme, karne ya da ilanlarım gibi her giriş noktasında aynı kimlik kapısı geçerli.
  useEffect(() => { requireLevel(2); }, []);

  // Yarım kalan ilan bu cihazdan geri yüklenir; sonra her değişiklik kısa bir gecikmeyle kaydedilir.
  useEffect(() => {
    if (isEdit) return;
    let alive = true;
    loadListingDraft(userId).then((d) => {
      if (!alive) return;
      if (d) {
        // Telefonda silinmiş fotoğraf/belge dosyaları düşer; kullanıcıya kaç tanesinin yeniden ekleneceği söylenir.
        const { state, lostPhotos } = dropMissingFiles(d, draftFileExists);
        setS(state);
        setRestored({ lostPhotos, noPhotos: state.photos.length === 0 });
        seedRef.current = state.photos.reduce((m, p) => Math.max(m, p.seed + 1), 1);
      } else if (loadedOnce.current) {
        // Başka hesaba geçildi ve onun taslağı yok: önceki hesabın formu bu hesaba taşınmaz.
        setS(emptyWizard());
        setRestored(null);
      }
      loadedOnce.current = true;
      setLoadedFor(userId ?? 'demo');
    });
    return () => { alive = false; };
  }, [userId, isEdit]);
  useEffect(() => {
    if (isEdit || !loaded || done) return;
    const h = setTimeout(() => { void saveListingDraft(userId, s); }, 400);
    return () => clearTimeout(h);
  }, [s, loaded, done, userId, isEdit]);

  const update = (patch: Partial<WizardState>) => setS((cur) => ({ ...cur, ...patch }));
  // Firma adına ilan: kullanıcının üyesi olduğu firmalar (yoksa seçim gösterilmez).
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { if (isApiMode()) attempt(() => actions.myCompanies()).then((c) => { if (c) setCompanies(c); }); }, []);
  const set = (k: keyof WizardFields) => (v: string) => setS((cur) => ({ ...cur, f: { ...cur.f, [k]: v } }));
  const [writing, setWriting] = useState(false);
  const [writeNote, setWriteNote] = useState('');
  /** Açıklama taslağı: kutudaki yazı not olarak gider; dönen taslak kutuya yazılır, satıcı düzenler. */
  const writeDescription = async () => {
    const facts = describeFacts(s);
    if (!facts) { setWriteNote(t('wizard.writeNeeds')); return; }
    setWriting(true); setWriteNote('');
    const r = await attempt(() => actions.describeListing(facts));
    setWriting(false);
    if (r) { set('description')(r.text.slice(0, 4000)); setWriteNote(t(r.source === 'llm' ? 'wizard.writeDoneLlm' : 'wizard.writeDoneRules')); }
  };
  const step = s.step;
  const errors: StepErrors = validateStep(step, s);
  const err = (k: keyof StepErrors) => (showErrors && errors[k] ? t(errors[k]!) : undefined);

  const discardDraft = async () => {
    await clearListingDraft(userId);
    clearDraftFiles();
    // Sunucuda yarım kalmış taslak varsa o da silinir (İlanlarım'da sahipsiz kalmasın).
    if (s.serverId) await actions.withdrawListing(s.serverId).catch(() => undefined);
    setS(emptyWizard());
    setRestored(null);
    setConfirmDiscard(false);
    setShowErrors(false);
    setSelected(null);
  };

  const addMore = async () => {
    const room = MAX_LISTING_PHOTOS - s.photos.length;
    if (room <= 0) return;
    if (isApiMode()) {
      const picked = await pickImages(room);
      if (!picked.length) return;
      const uris = await Promise.all(picked.map(keepDraftFile));
      setS((cur) => ({ ...cur, photos: addPhotos(cur.photos, uris.map((uri) => ({ uri, seed: seedRef.current++ })), newPhotoId) }));
    } else {
      setS((cur) => ({ ...cur, photos: addPhotos(cur.photos, [{ seed: seedRef.current++ }], newPhotoId) }));
    }
    setRestored(null);
  };

  // Düzenlenecek ilan bu cihazda yoksa (ör. eski bağlantı) form açılmaz.
  if (isEdit && !editing && !done) return <NotFound />;

  const draft = toDraft(s);
  const previewListing: Listing = {
    ...draft, id: 'preview', badges: s.doc ? ['sahiplik'] : [], sellerId: 'me', logbookCount: 0, status: 'onay-bekliyor',
    photoSeed: s.photos[0]?.seed ?? 0, photoUrls: s.photos.map((p) => p.uri).filter((u): u is string => !!u),
  };

  if (done) {
    const title = { created: t('wizard.doneTitle'), price: t('wizard.editDonePrice'), review: t('wizard.editDoneReview'), none: t('wizard.editNothing') }[doneKind];
    const body = doneKind === 'created' || doneKind === 'review' ? t('wizard.doneBody') : undefined;
    return (
      <Screen>
        <Header title="" />
        <SuccessView title={title} body={body} actions={[
          { title: t('wizard.goMine'), onPress: () => router.replace('/profil/ilanlarim') },
          { title: t('wizard.goHome'), onPress: () => router.dismissTo('/kesfet'), variant: 'ghost' },
        ]} />
      </Screen>
    );
  }

  // Düzenleme: yalnızca değişen alanlar; fiyat dışında değişiklik ya da fotoğraf değişikliği yayındaki ilanı onaya düşürür.
  const changes = origin ? draftChanges(toDraft(origin), draft) : {};
  const photosDirty = origin ? photosChanged(origin.photos, s.photos) : false;
  // Sunucuyla aynı kural: ölçüsüz fiyat değişikliği (yarısının altı, bir buçuk katının üstü) onaya düşer.
  const priceOnly = Object.keys(changes).length > 0 && Object.keys(changes).every((k) => k === 'price') && !photosDirty
    && !(editing && changes.price !== undefined && priceNeedsReview(editing.price, changes.price));
  const editNeedsReview = isEdit && editing?.status === 'yayinda' && (photosDirty || (Object.keys(changes).length > 0 && !priceOnly));
  const save = async () => {
    if (!editId) return;
    if (!Object.keys(changes).length && !photosDirty && editing?.status !== 'reddedildi') { setDoneKind('none'); setDone(true); return; }
    setBusy(true);
    const ok = await attempt(async () => {
      await actions.updateListing(editId, changes, photosDirty ? s.photos.map((p) => ({ uri: p.uri, fileId: p.fileId })) : undefined,
        { onProgress: (d, total) => setProgress({ done: d, total }) });
      return true;
    });
    setBusy(false);
    setProgress(null);
    if (ok) {
      clearDraftFiles();
      setDoneKind(priceOnly && editing?.status === 'yayinda' ? 'price' : 'review');
      setDone(true);
    }
  };

  if (preview) {
    return (
      <Screen footer={
        <View style={{ gap: space(2) }}>
        {progress ? <T variant="caption" color={colors.muted} style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">{t('wizard.uploading', { done: progress.done, total: progress.total })}</T> : null}
        <View style={{ flexDirection: 'row', gap: space(3) }}>
          <View style={{ flex: 1 }}><Button variant="ghost" title={t('common.back')} disabled={busy} onPress={() => setPreview(false)} /></View>
          <View style={{ flex: 2 }}><Button title={isEdit ? t('wizard.save') : t('wizard.publish')} loading={busy} onPress={async () => {
            if (isEdit) return save();
            if (!requireLevel(2)) return;
            setBusy(true);
            // Uygulama kapanıp açıldıysa sunucudaki yarım taslaktan devam edilir.
            if (s.serverId) actions.resumePublish(s.serverId);
            const id = await attempt(() => actions.createListing(draft, {
              onDraftCreated: (serverId) => update({ serverId }),
              photoUris: s.photos.map((p) => p.uri).filter((u): u is string => !!u), broker: s.broker,
              ownershipUri: s.docUri ?? undefined, engineDocUri: s.engineDocUri ?? undefined, engineSerialLast4: s.engineSerial.trim() || undefined,
              onProgress: (done, total) => setProgress({ done, total }),
            }));
            setBusy(false);
            setProgress(null);
            if (id) {
              await clearListingDraft(userId);
              clearDraftFiles();
              setDone(true);
            }
          }} /></View>
        </View>
        </View>
      }>
        <Header title={t('wizard.preview')} back={false} />
        {editNeedsReview ? (
          <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.button, padding: space(3) }}>
            <T variant="caption" color={colors.accentText}>{t('wizard.editReviewNote')}</T>
          </View>
        ) : null}
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
    if (step < steps.length - 1) { update({ step: step + 1 }); return; }
    // Son adımda tüm adımlar yeniden denetlenir; hatalı adım varsa oraya dönülür ve hata gösterilir.
    const bad = firstInvalidStep(s);
    if (bad >= 0) { update({ step: bad }); setShowErrors(true); return; }
    setPreview(true);
  };
  const sel = s.photos.findIndex((p) => p.id === selected);
  const row = { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) } as const;

  return (
    <Screen footer={
      <View style={{ gap: space(2) }}>
        {showErrors && hasErrors ? <T variant="caption" color={colors.danger} style={{ textAlign: 'center' }}>{t('wizard.err.fix')}</T> : null}
        <View style={{ flexDirection: 'row', gap: space(3) }}>
          {step > 0 ? <View style={{ flex: 1 }}><Button variant="ghost" title={t('common.back')} onPress={() => { setShowErrors(false); update({ step: step - 1 }); }} /></View> : null}
          <View style={{ flex: 2 }}><Button title={step === steps.length - 1 ? t('wizard.preview') : t('common.next')} disabled={!loaded} onPress={next} /></View>
        </View>
      </View>
    }>
      <Header title={isEdit ? t('wizard.editTitle') : t('wizard.title')} />
      <Stepper steps={steps.map((x) => t(`wizard.steps.${x}`))} current={step} />
      {/* Girişten dönen kullanıcı formu doldurmadan önce kimlik adımını görsün (yayınlarken sürpriz olmasın). */}
      {!isEdit && verifyLevel < 2 ? (
        <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.button, padding: space(3), gap: space(2) }}>
          <T variant="caption" color={colors.accentText}>{t('wizard.verifyBanner')}</T>
          <Button small variant="secondary" title={t('wizard.verifyBannerCta')} onPress={() => router.push('/verify/identity')} />
        </View>
      ) : null}

      {restored ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.button, padding: space(3), gap: space(1.5) }}>
          <T variant="caption">
            {t('wizard.draftRestored')}
            {restored.lostPhotos > 0 ? ` ${t('wizard.draftPhotosMissing', { count: restored.lostPhotos })}` : restored.noPhotos ? ` ${t('wizard.draftPhotosLost')}` : ''}
          </T>
          {confirmDiscard ? (
            <View style={{ gap: space(2) }}>
              <T variant="caption">{t('wizard.discardConfirm')}</T>
              <View style={{ flexDirection: 'row', gap: space(2) }}>
                <View style={{ flex: 1 }}><Button small variant="secondary" title={t('common.cancel')} onPress={() => setConfirmDiscard(false)} /></View>
                <View style={{ flex: 1 }}><Button small variant="danger" title={t('wizard.draftDiscard')} onPress={discardDraft} /></View>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDiscard(true)} accessibilityRole="button" hitSlop={8}>
              <T variant="caption" color={colors.primary} style={{ fontFamily: fonts.bodyBold }}>{t('wizard.draftDiscard')}</T>
            </Pressable>
          )}
        </View>
      ) : null}

      {step === 0 ? (
        <Section title={t('wizard.steps.photos')}>
          <T variant="caption" color={colors.muted}>{t('wizard.photosHint')} {t('wizard.photosHint2')}</T>
          <T variant="caption" color={colors.primary} style={{ fontFamily: fonts.bodyBold }}>{t('wizard.photosCount', { count: s.photos.length, max: MAX_LISTING_PHOTOS })}</T>
          <View style={row}>
            {s.photos.map((p, i) => (
              <Pressable key={p.id} onPress={() => { setSelected(selected === p.id ? null : p.id); setConfirmRemove(false); }}
                accessibilityRole="button" accessibilityLabel={t(i === 0 ? 'wizard.photoLabelCover' : 'wizard.photoLabel', { n: i + 1, total: s.photos.length })} accessibilityState={{ selected: selected === p.id }}
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
          <Field label={t('wizard.video')} value={s.f.videoUrl} onChangeText={set('videoUrl')} placeholder="https://youtu.be/…" autoCapitalize="none" keyboardType="url" maxLength={300} error={err('videoUrl')} />
          <Button small variant="secondary" icon="sparkle" loading={writing} title={t('wizard.writeForMe')} onPress={() => void writeDescription()} />
          <T variant="caption" color={colors.muted}>{writeNote || t('wizard.writeHint')}</T>
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
          {!editing && companies.length ? (
            <Section title={t('wizard.seller')}>
              <View style={row}>
                <Chip label={t('wizard.sellerSelf')} selected={!s.companyId} onPress={() => update({ companyId: undefined })} />
                {companies.map((c) => <Chip key={c.id} label={c.name} selected={s.companyId === c.id} onPress={() => update({ companyId: c.id })} />)}
              </View>
            </Section>
          ) : null}
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
          <UploadBox label={t('wizard.docLabel')} state={s.doc ? 'eklendi' : 'bos'} onPress={async () => {
            if (isApiMode()) {
              const uri = await pickImage();
              if (!uri) return;
              update({ docUri: await keepDraftFile(uri) });
            }
            update({ doc: true });
          }} />
          {/* Motor seri numarası ruhsatla birlikte incelenir; ruhsat yokken tek başına gönderilmez. */}
          {s.doc ? <UploadBox label={t('wizard.engineDocLabel')} state={s.engineDoc ? 'eklendi' : 'bos'} onPress={async () => {
            if (isApiMode()) {
              const uri = await pickImage();
              if (!uri) return;
              update({ engineDocUri: await keepDraftFile(uri) });
            }
            update({ engineDoc: true });
          }} /> : null}
          {s.doc && s.engineDoc ? (
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
