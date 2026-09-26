import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Field, Header, Icon, Screen, Segmented, SuccessView, T, UploadBox, goBack } from '@/components';
import { useSession } from '@/session/role';
import { actions, isApiMode } from '@/services';
import { attempt } from '@/services/errors';
import { pickImage } from '@/services/pickImage';

export default function Identity() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'tc' | 'foreign'>('tc');
  const [f, setF] = useState({ tckn: '', first: '', last: '', year: '', passport: '', nat: '' });
  const [photo, setPhoto] = useState(false);
  const [phase, setPhase] = useState<'form' | 'loading' | 'done'>('form');
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const valid = mode === 'tc'
    ? f.tckn.length === 11 && f.first && f.last && f.year.length === 4
    : f.passport.length >= 5 && f.nat && f.first && f.last && f.year.length === 4 && photo;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async () => {
    setPhase('loading');
    const person = { firstName: f.first, lastName: f.last, birthYear: Number(f.year) || 1990 };
    const r = await attempt(() => actions.verifyIdentity(mode === 'tc'
      ? { tckn: f.tckn, ...person }
      : { passport: f.passport, nationality: f.nat, ...person, fileUri: photoUri ?? '' }));
    if (!r) return setPhase('form');
    setPending(r.pending);
    setPhase('done');
  };


  if (phase === 'done') {
    return (
      <Screen>
        <Header title="" />
        <SuccessView title={t(pending ? 'verify.pendingTitle' : 'verify.successTitle')} body={t(pending ? 'verify.pendingBody' : 'verify.successBody')} actions={[{ title: t('common.continue'), onPress: goBack }]} />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title={t('verify.submit')} disabled={!valid} loading={phase === 'loading'} onPress={submit} />}>
      <Header title={t('verify.idTitle')} subtitle={t('verify.idSubtitle')} />
      <Segmented options={[{ key: 'tc', label: t('verify.citizen') }, { key: 'foreign', label: t('verify.foreign') }]} value={mode} onChange={setMode} />
      {mode === 'tc' ? (
        <Field label={t('verify.tckn')} value={f.tckn} onChangeText={(v) => set('tckn')(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={11} placeholder="•••••••••••" />
      ) : (
        <>
          <Field label={t('verify.passport')} value={f.passport} onChangeText={set('passport')} />
          <Field label={t('verify.nationality')} value={f.nat} onChangeText={set('nat')} />
        </>
      )}
      <Field label={t('verify.firstName')} value={f.first} onChangeText={set('first')} />
      <Field label={t('verify.lastName')} value={f.last} onChangeText={set('last')} />
      {mode === 'tc' ? (
        <Field label={t('verify.birthYear')} value={f.year} onChangeText={(v) => set('year')(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} />
      ) : (
        <>
        <Field label={t('verify.birthYear')} value={f.year} onChangeText={(v) => set('year')(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} />
        <UploadBox label={t('verify.passportPhoto')} state={photo ? 'yuklendi' : 'bos'} onPress={async () => {
          if (!isApiMode()) return setPhoto(true);
          const uri = await pickImage();
          if (uri) { setPhotoUri(uri); setPhoto(true); }
        }} />
        </>
      )}
      <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
        <Icon name="shield" size={18} color={colors.primary} />
        <T variant="caption" color={colors.muted} style={{ flex: 1 }}>{t('verify.noFace')}</T>
      </View>
    </Screen>
  );
}
