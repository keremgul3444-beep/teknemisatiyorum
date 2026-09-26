import { useState } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space, radius, fonts } from '@/theme';
import { Button, Header, Screen, T, goBack } from '@/components';
import { useSession } from '@/session/role';
import { actions, useMode } from '@/services';
import { attempt } from '@/services/errors';

export default function Login() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const digits = phone.replace(/\D/g, '');
  const mode = useMode((s) => s.mode);
  const [busy, setBusy] = useState(false);
  const social = () => {
    useSession.getState().login();
    goBack();
  };
  return (
    <Screen>
      <Header title="" />
      <View style={{ gap: space(2) }}>
        <T variant="h1">{t('auth.title')}</T>
        <T color={colors.muted}>{t('auth.subtitle')}</T>
      </View>
      <T variant="label" color={colors.muted}>{t('auth.phone').toLocaleUpperCase('tr-TR')}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.button }}>
        <T variant="bodySemi" style={{ paddingHorizontal: space(3), borderRightWidth: 1, borderColor: colors.line, paddingVertical: space(3) }}>🇹🇷 +90</T>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="5xx xxx xx xx" placeholderTextColor={colors.muted} maxLength={13}
          style={{ flex: 1, padding: space(3), fontFamily: fonts.body, fontSize: 16, color: colors.text }} />
      </View>
      <Button title={t('auth.sendCode')} disabled={digits.length < 10} loading={busy} onPress={async () => {
        setBusy(true);
        const r = await attempt(async () => ({ dev: await actions.requestOtp(`+90${digits.slice(-10)}`) }));
        setBusy(false);
        if (r) router.push({ pathname: '/auth/otp', params: { phone: `+90${digits.slice(-10)}`, ...(r.dev ? { dev: r.dev } : {}) } });
      }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        <T variant="caption" color={colors.muted}>{t('auth.or')}</T>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      </View>
      {mode === 'demo' ? (
        <>
          <Button variant="ghost" title={t('auth.google')} onPress={social} />
          <Button variant="ghost" title={t('auth.apple')} onPress={social} />
        </>
      ) : null}
      <Pressable onPress={() => router.push('/auth/kvkk')}>
        <T variant="caption" color={colors.primary} style={{ textAlign: 'center', textDecorationLine: 'underline' }}>{t('auth.kvkkLink')}</T>
      </Pressable>
    </Screen>
  );
}
