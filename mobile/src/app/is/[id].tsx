import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Avatar, Button, Card, Header, Icon, NotFound, Rating, Screen, Section, Stepper, SuccessView, T } from '@/components';
import { actions, formatPrice, JOB_STEPS, useJob, useAllProviders } from '@/services';
import { currentLang } from '@/i18n';
import { demoOnly } from '@/components/DemoOnly';

function IsDetay() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  const providers = useAllProviders();
  const [stars, setStars] = useState(5);
  if (!job) return <NotFound />;
  const lang = currentLang();
  const usta = (pid?: string) => providers.find((p) => p.id === pid);
  const accepted = job.offers.find((o) => o.id === job.acceptedOfferId);
  const current = job.status === 'degerlendirildi' ? JOB_STEPS.length - 1 : JOB_STEPS.indexOf(job.status);
  const chat = async () => {
    const u = usta(accepted?.providerId ?? job.offers[0]?.providerId);
    const conv = await actions.startConversation({ kind: 'is', id: job.id, title: job.title }, u?.name ?? '—');
    router.push(`/sohbet/${conv}`);
  };

  return (
    <Screen>
      <Header title={job.title} subtitle={`${t(`usta.cat.${job.category}`)} · ${t('job.createdAt', { date: job.createdAt })}`} />
      <Stepper steps={JOB_STEPS.map((s) => t(`job.steps.${s}`))} current={current} />

      {job.status === 'teklif' ? (
        <Section title={t('job.offers', { count: job.offers.length })}>
          <T variant="caption" color={colors.muted}>{t('job.compare')}</T>
          {job.offers.map((o) => {
            const u = usta(o.providerId);
            const cheapest = o.priceTRY === Math.min(...job.offers.map((x) => x.priceTRY));
            return (
              <Card key={o.id} style={cheapest ? { borderColor: colors.primary, borderWidth: 1.5 } : undefined}>
                <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
                  <Avatar name={u?.name ?? '?'} size={40} />
                  <Pressable style={{ flex: 1 }} onPress={() => u && router.push(`/usta/${u.id}`)}>
                    <T variant="h3">{u?.name}</T>
                    <Rating value={u?.rating ?? 0} count={u?.reviewCount} />
                  </Pressable>
                  <View style={{ alignItems: 'flex-end' }}>
                    <T variant="h3" color={colors.primary}>{formatPrice(o.priceTRY, 'TRY', lang)}</T>
                    <T variant="caption" color={colors.muted}>{t('job.days', { count: o.days })}</T>
                  </View>
                </View>
                <T variant="caption" color={colors.muted}>{o.note}</T>
                <Button small title={t('job.accept')} onPress={() => actions.acceptOffer(job.id, o.id)} />
              </Card>
            );
          })}
        </Section>
      ) : null}

      {accepted ? (
        <Section title={t('job.accepted')}>
          <Card>
            <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
              <Avatar name={usta(accepted.providerId)?.name ?? '?'} size={40} />
              <View style={{ flex: 1 }}>
                <T variant="h3">{usta(accepted.providerId)?.name}</T>
                <T variant="caption" color={colors.muted}>{accepted.note}</T>
              </View>
              <T variant="h3" color={colors.primary}>{formatPrice(accepted.priceTRY, 'TRY', lang)}</T>
            </View>
          </Card>
        </Section>
      ) : null}

      {job.status === 'onay' ? (
        <Card>
          <T variant="h3">{t('job.payTitle')}</T>
          <T color={colors.muted}>{t('job.payBody')}</T>
          <Button icon="lock" title={t('job.pay')} onPress={() => router.push({ pathname: '/odeme', params: { tur: 'is', id: job.id } })} />
        </Card>
      ) : null}

      {job.status === 'devam' ? (
        <Card>
          <T variant="h3">{t('job.inProgress')}</T>
          <T color={colors.muted}>{t('job.inProgressBody')}</T>
          <Button icon="check" title={t('job.complete')} onPress={() => actions.completeJob(job.id)} />
        </Card>
      ) : null}

      {job.status === 'tamam' ? (
        <Card>
          <T variant="h3">{t('job.rateTitle')}</T>
          <T color={colors.muted}>{t('job.rateBody')}</T>
          <View style={{ flexDirection: 'row', gap: space(2), justifyContent: 'center', paddingVertical: space(2) }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}><Icon name="star" size={34} color={colors.warning} filled={n <= stars} /></Pressable>
            ))}
          </View>
          <Button title={t('job.rate')} onPress={() => actions.rateJob(job.id, stars)} />
        </Card>
      ) : null}

      {job.status === 'degerlendirildi' ? (
        <SuccessView title={t('job.ratedTitle')} body={t('job.ratedBody')}
          actions={[{ title: t('job.seeLogbook'), onPress: () => router.push(`/teknelerim/${job.boatId}`) }]} />
      ) : null}

      <Button variant="ghost" icon="mail" title={t('job.chat')} onPress={chat} />
    </Screen>
  );
}

export default demoOnly(IsDetay);
