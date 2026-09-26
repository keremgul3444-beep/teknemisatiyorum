import { useEffect, useRef, useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space, radius, fonts } from '@/theme';
import { Button, Header, Screen, T, showDemoToast } from '@/components';
import { useSession } from '@/session/role';
import { actions, isApiMode } from '@/services';
import { attempt } from '@/services/errors';

export default function Otp() {
  const { t } = useTranslation();
  const { phone = '', dev } = useLocalSearchParams<{ phone?: string; dev?: string }>();
  const [code, setCode] = useState(dev ?? '');
  const [left, setLeft] = useState(30);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const [busy, setBusy] = useState(false);
  const verify = async () => {
    setBusy(true);
    const ok = await attempt(async () => { await actions.verifyOtp(String(phone), code); return true; });
    setBusy(false);
    if (!ok) return;
    // Girişi isteyen ekrana geri dön (login + otp iki adım geri); yığın yoksa Keşfet.
    router.dismiss(2);
  };


  return (
    <Screen>
      <Header title="" />
      <T variant="h1">{t('auth.otpTitle')}</T>
      <T color={colors.muted}>{t('auth.otpSubtitle', { phone })}</T>
      <Pressable onPress={() => input.current?.focus()} style={{ flexDirection: 'row', gap: space(2), justifyContent: 'space-between' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={{ flex: 1, aspectRatio: 0.85, borderRadius: radius.button, borderWidth: 1.5,
            borderColor: i === code.length ? colors.primary : colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
            <T variant="h2">{code[i] ?? ''}</T>
          </View>
        ))}
      </Pressable>
      <TextInput ref={input} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoFocus
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1, fontFamily: fonts.body }} />
      <T variant="caption" color={colors.muted}>{t(isApiMode() ? 'auth.betaHint' : 'auth.demoHint')}</T>
      <Button title={t('auth.verify')} disabled={code.length < 6} loading={busy} onPress={verify} />
      <Button variant="ghost" disabled={left > 0} title={left > 0 ? t('auth.resendIn', { s: left }) : t('auth.resend')}
        onPress={() => { setLeft(30); attempt(() => actions.requestOtp(String(phone))).then((c) => c && setCode(c)); showDemoToast(); }} />
    </Screen>
  );
}
