import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { space } from '@/theme';
import { Button, Chip, Header, Screen, Section, SuccessView, UploadBox, showDemoToast, type UploadState } from '@/components';
import { useSession } from '@/session/role';

type ProRole = 'usta' | 'kaptan' | 'eksper' | 'firma';
const DOCS: Record<ProRole, string[]> = {
  usta: ['vergi', 'ustalik'],
  kaptan: ['kaptanYeterlik', 'src', 'ilkYardim'],
  eksper: ['sorvey', 'vergi'],
  firma: ['vergi', 'sicil', 'imza'],
};
const ROLE_LABEL: Record<ProRole, string> = { usta: 'roleUsta', kaptan: 'roleKaptan', eksper: 'roleEksper', firma: 'roleFirma' };

export default function Professional() {
  const { t } = useTranslation();
  const [role, setRole] = useState<ProRole>('usta');
  const [docs, setDocs] = useState<Record<string, UploadState>>({});
  const [done, setDone] = useState(false);
  const all = DOCS[role].every((d) => docs[d] && docs[d] !== 'bos');

  if (done) {
    return (
      <Screen>
        <SuccessView title={t('verify.proDoneTitle')} body={t('verify.proDoneBody')}
          actions={[{ title: t('common.done'), onPress: () => router.dismissTo('/profil') }]} />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title={t('verify.sendApp')} disabled={!all} onPress={() => {
      const s = useSession.getState();
      s.setVerifyLevel(3);
      if (role === 'usta' || role === 'kaptan') s.setRole(role);
      if (role === 'firma') s.setRole('kurumsal');
      setDone(true);
    }} />}>
      <Header title={t('verify.proTitle')} subtitle={t('verify.proSubtitle')} />
      <Section title={t('verify.role')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {(Object.keys(DOCS) as ProRole[]).map((r) => (
            <Chip key={r} label={t(`verify.${ROLE_LABEL[r]}`)} selected={role === r} onPress={() => { setRole(r); setDocs({}); }} />
          ))}
        </View>
      </Section>
      <Section title={t('verify.docs')}>
        {DOCS[role].map((d) => (
          <UploadBox key={d} label={t(`verify.doc.${d}`)} state={docs[d] ?? 'bos'}
            onPress={() => { setDocs((s) => ({ ...s, [d]: 'incelemede' })); showDemoToast(); }} />
        ))}
      </Section>
    </Screen>
  );
}
