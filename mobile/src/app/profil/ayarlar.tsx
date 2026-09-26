import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, Chip, Divider, Header, MenuRow, Screen, Section, Segmented, T, ToggleRow, showDemoToast } from '@/components';
import { actions, type Role } from '@/services';
import { currentLang, setLanguage, type Lang } from '@/i18n';
import { useSession, type Prefs } from '@/session/role';
import { attempt } from '@/services/errors';
import { API_URL, useMode } from '@/services/mode';

const ROLES: Role[] = ['bireysel', 'usta', 'kaptan', 'kurumsal', 'yonetici'];

export default function Ayarlar() {
  const { t } = useTranslation();
  const role = useSession((s) => s.role);
  const { mode, setMode } = useMode();
  const [lang, setLang] = useState<Lang>(currentLang());
  // Tercihler oturumda (gerçek modda sunucudan gelir); değişiklik anında kaydedilir.
  const prefs = useSession((s) => s.prefs);
  const [jobs, setJobs] = useState(true);
  const setPref = (k: keyof Prefs, v: boolean) => attempt(() => actions.updateProfile({ prefs: { [k]: v } }));

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
        <Segmented value={lang} onChange={(l) => { setLang(l); setLanguage(l); attempt(() => actions.updateProfile({ lang: l })); }} options={[{ key: 'tr', label: 'Türkçe' }, { key: 'en', label: 'English' }]} />
      </Section>
      <Section title={t('settings.notifications')}>
        <Card>
          <ToggleRow label={t('settings.nMessages')} value={prefs.notifyMessages} onChange={(v) => setPref('notifyMessages', v)} />
          <ToggleRow label={t('settings.nMatches')} value={prefs.notifyMatches} onChange={(v) => setPref('notifyMatches', v)} />
          {mode === 'demo' ? <ToggleRow label={t('settings.nJobs')} value={jobs} onChange={setJobs} /> : null}
          <ToggleRow label={t('settings.nMarketing')} value={prefs.notifyMarketing} onChange={(v) => setPref('notifyMarketing', v)}
            disabled={!prefs.marketingConsent} hint={prefs.marketingConsent ? undefined : t('settings.nMarketingHint')} />
        </Card>
      </Section>
      <Section title={t('settings.privacy')}>
        <Card>
          <ToggleRow label={t('settings.phoneVisible')} value={prefs.phoneVisible} onChange={(v) => setPref('phoneVisible', v)} />
          <ToggleRow label={t('settings.marketingConsent')} value={prefs.marketingConsent} onChange={(v) => setPref('marketingConsent', v)} />
          <Divider />
          <MenuRow icon="doc" label={t('settings.download')} onPress={() => attempt(() => actions.exportData()).then((ok) => showDemoToast(t(ok ? 'settings.downloadReady' : 'settings.downloadDone')))} />
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
          {API_URL ? (
            <>
              <T variant="caption" color={colors.muted}>{t('settings.modeHint')}</T>
              <Segmented value={mode} onChange={(m) => {
                setMode(m);
                if (m === 'demo') { actions.resetDemo(); useSession.getState().logout(); }
                showDemoToast(t(m === 'api' ? 'settings.modeApi' : 'settings.modeDemo'));
              }} options={[{ key: 'api', label: t('settings.modeApiShort') }, { key: 'demo', label: t('settings.modeDemoShort') }]} />
            </>
          ) : null}
          {mode === 'demo' ? (
            <>
              <T variant="caption" color={colors.muted}>{t('settings.demoRole')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
                {ROLES.map((r) => <Chip key={r} label={t(`profile.role.${r}`)} selected={role === r} onPress={() => pickRole(r)} />)}
              </View>
              <Button small variant="ghost" icon="x" title={t('settings.reset')} onPress={() => { actions.resetDemo(); showDemoToast(t('settings.resetDone')); }} />
            </>
          ) : null}
        </Card>
      </Section>
    </Screen>
  );
}
