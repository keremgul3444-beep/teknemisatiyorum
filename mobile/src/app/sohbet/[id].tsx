import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Button, Header, Icon, NotFound, T } from '@/components';
import { actions, useConversation, type SubjectKind } from '@/services';
import { attempt } from '@/services/errors';

const SUBJECT_ROUTE: Record<SubjectKind, (id: string) => string> = {
  ilan: (id) => `/ilan/${id}`, is: (id) => `/is/${id}`, kaptan: (id) => `/kaptan/${id}`, broker: (id) => `/broker/${id}`,
};

export default function Sohbet() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useConversation(id);
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => { if (id) attempt(() => actions.openConversation(id)); }, [id]);
  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); }, [c?.messages.length]);
  if (!c) return <NotFound />;

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    setText('');
    await attempt(() => actions.sendMessage(c.id, msg));
    setTimeout(() => actions.demoReply(c.id, t('messages.autoReply')), 1500);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ padding: space(4), gap: space(3), borderBottomWidth: 1, borderColor: colors.line }}>
          <Header title={c.withName} right={!c.phoneShared ? (
            <Pressable onPress={() => setConfirm(true)} hitSlop={8} accessibilityLabel={t('messages.sharePhone')}><Icon name="phone" size={22} color={colors.primary} /></Pressable>
          ) : undefined} />
          <Pressable onPress={() => router.push(SUBJECT_ROUTE[c.subject.kind](c.subject.id) as any)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), backgroundColor: colors.card, borderRadius: radius.button, padding: space(3), borderWidth: 1, borderColor: colors.line }}>
            <Icon name={c.subject.kind === 'ilan' ? 'anchor' : c.subject.kind === 'kaptan' ? 'compass' : 'wrench'} size={18} color={colors.primary} />
            <T variant="caption" style={{ flex: 1, fontFamily: fonts.bodySemi }} numberOfLines={1}>{t(`messages.kind.${c.subject.kind}`)} · {c.subject.title}</T>
            <Icon name="chevron" size={16} color={colors.muted} />
          </Pressable>
          {confirm ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.button, padding: space(3), gap: space(2) }}>
              <T variant="caption">{t('messages.sharePhoneConfirm')}</T>
              <View style={{ flexDirection: 'row', gap: space(2) }}>
                <View style={{ flex: 1 }}><Button small variant="ghost" title={t('common.cancel')} onPress={() => setConfirm(false)} /></View>
                <View style={{ flex: 1 }}><Button small title={t('messages.sharePhone')} onPress={async () => { await attempt(() => actions.sharePhone(c.id)); setConfirm(false); }} /></View>
              </View>
            </View>
          ) : null}
        </View>

        <ScrollView ref={scroll} contentContainerStyle={{ padding: space(4), gap: space(2) }}>
          <View style={{ flexDirection: 'row', gap: space(2), alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.sm, padding: space(2), marginBottom: space(2) }}>
            <Icon name="shield" size={14} color={colors.muted} />
            <T variant="caption" color={colors.muted}>{t('messages.safety')}</T>
          </View>
          {c.messages.length === 0 ? <T variant="caption" color={colors.muted} style={{ textAlign: 'center' }}>{t('messages.noMessages')}</T> : null}
          {c.messages.map((m) => (
            <View key={m.id} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '80%',
              backgroundColor: m.from === 'me' ? colors.primary : colors.card, borderRadius: 16,
              borderBottomRightRadius: m.from === 'me' ? 4 : 16, borderBottomLeftRadius: m.from === 'me' ? 16 : 4,
              borderWidth: m.from === 'me' ? 0 : 1, borderColor: colors.line, paddingVertical: space(2), paddingHorizontal: space(3) }}>
              <T color={m.from === 'me' ? colors.white : colors.text}>{m.text}</T>
              <T variant="caption" color={m.from === 'me' ? colors.surface : colors.muted} style={{ fontSize: 10, alignSelf: 'flex-end' }}>{m.at}</T>
            </View>
          ))}
          {c.phoneShared ? (
            <T variant="caption" color={colors.primary} style={{ textAlign: 'center', marginTop: space(2) }}>{t('messages.phoneShared')}</T>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: space(2), padding: space(3), borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}>
          <TextInput value={text} onChangeText={setText} placeholder={t('messages.placeholder')} placeholderTextColor={colors.muted} onSubmitEditing={send}
            style={{ flex: 1, backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: space(4), paddingVertical: space(2.5), fontFamily: fonts.body, fontSize: 15, color: colors.text }} />
          <Pressable onPress={send} accessibilityLabel={t('common.send')}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" size={20} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
