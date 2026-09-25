import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Field, Header, Icon, Screen, Segmented, SuccessView, T, UploadBox, goBack } from '@/components';
import { useSession } from '@/session/role';

export default function Identity() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'tc' | 'foreign'>('tc');
  const [f, setF] = useState({ tckn: '', first: '', last: '', year: '', passport: '', nat: '' });
  const [photo, setPhoto] = useState(false);
  const [phase, setPhase] = useState<'form' | 'loading' | 'done'>('form');
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const valid = mode === 'tc'
    ? f.tckn.length === 11 && f.first && f.last && f.year.length === 4
    : f.passport.length >= 6 && f.nat && f.first && f.last && photo;

  const submit = () => {
    setPhase('loading');
    setTimeout(() => {
      const s = useSession.getState();
      s.login();
      s.setVerifyLevel(Math.max(2, s.verifyLevel) as 2);
      setPhase('done');
    }, 1200);
  };

  if (phase === 'done') {
    return (
      <Screen>
        <SuccessView title={t('verify.successTitle')} body={t('verify.successBody')} actions={[{ title: t('common.continue'), onPress: goBack }]} />
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
        <UploadBox label={t('verify.passportPhoto')} state={photo ? 'yuklendi' : 'bos'} onPress={() => setPhoto(true)} />
      )}
      <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
        <Icon name="shield" size={18} color={colors.primary} />
        <T variant="caption" color={colors.muted} style={{ flex: 1 }}>{t('verify.noFace')}</T>
      </View>
    </Screen>
  );
}
