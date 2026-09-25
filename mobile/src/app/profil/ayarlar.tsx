import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, Chip, Divider, Header, MenuRow, Screen, Section, Segmented, T, ToggleRow, showDemoToast } from '@/components';
import { actions, type Role } from '@/services';
import { currentLang, setLanguage, type Lang } from '@/i18n';
import { useSession } from '@/session/role';

const ROLES: Role[] = ['bireysel', 'usta', 'kaptan', 'kurumsal', 'yonetici'];

export default function Ayarlar() {
  const { t } = useTranslation();
  const role = useSession((s) => s.role);
  const [lang, setLang] = useState<Lang>(currentLang());
  const [n, setN] = useState({ messages: true, matches: true, jobs: true, marketing: false });
  const [p, setP] = useState({ phone: false, marketing: false });

  const pickRole = (r: Role) => {
    const s = useSession.getState();
    if (!s.loggedIn) s.login();
    if (r !== 'bireysel' && s.verifyLevel < 3) s.setVerifyLevel(3);
    s.setRole(r);
    showDemoToast(t(`profile.role.${r}`));
  };

  return (
    <Screen>
      <Header title={t('settings.title')} />
      <Section title={t('settings.language')}>
        <Segmented value={lang} onChange={(l) => { setLang(l); setLanguage(l); }} options={[{ key: 'tr', label: 'Türkçe' }, { key: 'en', label: 'English' }]} />
      </Section>
      <Section title={t('settings.notifications')}>
        <Card>
          <ToggleRow label={t('settings.nMessages')} value={n.messages} onChange={(v) => setN((s) => ({ ...s, messages: v }))} />
          <ToggleRow label={t('settings.nMatches')} value={n.matches} onChange={(v) => setN((s) => ({ ...s, matches: v }))} />
          <ToggleRow label={t('settings.nJobs')} value={n.jobs} onChange={(v) => setN((s) => ({ ...s, jobs: v }))} />
          <ToggleRow label={t('settings.nMarketing')} value={n.marketing} onChange={(v) => setN((s) => ({ ...s, marketing: v }))} />
        </Card>
      </Section>
      <Section title={t('settings.privacy')}>
        <Card>
          <ToggleRow label={t('settings.phoneVisible')} value={p.phone} onChange={(v) => setP((s) => ({ ...s, phone: v }))} />
          <ToggleRow label={t('settings.marketingConsent')} value={p.marketing} onChange={(v) => setP((s) => ({ ...s, marketing: v }))} />
          <Divider />
          <MenuRow icon="doc" label={t('settings.download')} onPress={() => showDemoToast(t('settings.downloadDone'))} />
          <Divider />
          <MenuRow icon="shield" label={t('settings.kvkk')} onPress={() => router.push('/auth/kvkk')} />
          <Divider />
          <MenuRow icon="lock" label={t('settings.devices')} onPress={() => router.push('/profil/cihazlar')} />
          <Divider />
          <MenuRow icon="trash" danger label={t('settings.delete')} onPress={() => router.push('/profil/hesap-sil')} />
        </Card>
      </Section>
      <Section title={t('settings.demo')}>
        <Card style={{ borderColor: colors.warning, borderStyle: 'dashed', borderWidth: 1.5 }}>
          <T variant="caption" color={colors.muted}>{t('settings.demoRole')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {ROLES.map((r) => <Chip key={r} label={t(`profile.role.${r}`)} selected={role === r} onPress={() => pickRole(r)} />)}
          </View>
          <Button small variant="ghost" icon="x" title={t('settings.reset')} onPress={() => { actions.resetDemo(); showDemoToast(t('settings.resetDone')); }} />
        </Card>
      </Section>
    </Screen>
  );
}
