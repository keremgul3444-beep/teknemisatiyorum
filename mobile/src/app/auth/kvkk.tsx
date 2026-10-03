import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, CheckRow, Header, LegalDraftNote, Screen, T, goBack, showDemoToast } from '@/components';
import { actions } from '@/services';
import { attempt } from '@/services/errors';
import { useSession } from '@/session/role';

/**
 * Aydınlatma metni ve pazarlama izni. Yurt dışına aktarım açık rızaya değil KVKK m.9 standart sözleşmesine dayanır,
 * bu yüzden ayrı onay kutusu yok. Girişliyse pazarlama izni hesaba kaydedilir (ayarlardaki anahtarla aynı alan).
 */
export default function Kvkk() {
  const { t, i18n } = useTranslation();
  const signedIn = useSession((s) => s.loggedIn);
  const marketingNow = useSession((s) => s.prefs.marketingConsent);
  const [c, setC] = useState({ read: false, marketing: marketingNow });
  const [saving, setSaving] = useState(false);
  const toggle = (k: keyof typeof c) => setC((s) => ({ ...s, [k]: !s[k] }));
  const sections = Array.from({ length: 12 }, (_, i) => i + 1).filter((i) => i18n.exists(`kvkk.h${i}`));
  const confirm = async () => {
    if (signedIn && c.marketing !== marketingNow) {
      setSaving(true);
      const ok = await attempt(() => actions.updateProfile({ prefs: { marketingConsent: c.marketing } }));
      setSaving(false);
      if (!ok) return;
    }
    showDemoToast(t('kvkk.saved'));
    goBack();
  };
  return (
    <Screen footer={<Button title={t('common.confirm')} loading={saving} disabled={!c.read} onPress={confirm} />}>
      <Header title={t('kvkk.title')} />
      <LegalDraftNote />
      <Card>
        {sections.map((i) => (
          <View key={i} style={{ gap: space(1), marginBottom: space(2) }}>
            <T variant="h3">{t(`kvkk.h${i}`)}</T>
            <T color={colors.muted}>{t(`kvkk.b${i}`)}</T>
          </View>
        ))}
      </Card>
      <CheckRow label={t('kvkk.c1')} hint={t('common.required')} checked={c.read} onToggle={() => toggle('read')} />
      {signedIn ? <CheckRow label={t('kvkk.c2')} hint={t('common.optional')} checked={c.marketing} onToggle={() => toggle('marketing')} /> : null}
    </Screen>
  );
}
