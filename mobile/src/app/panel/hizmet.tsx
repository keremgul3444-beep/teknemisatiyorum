import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { router } from 'expo-router';
import { Button, Card, Chip, EmptyState, Field, Header, Icon, Screen, Section, StatusLine, T, showDemoToast } from '@/components';
import { actions, formatPrice, USTA_CATEGORIES, type UstaCategory } from '@/services';
import type { ApiJob, ApiProvider } from '@/services/api/mappers';
import { useMode } from '@/services/mode';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';
import { currentLang } from '@/i18n';

const REQS = ['req1', 'req2', 'req3'] as const;
const WEEK = [true, false, true, true, false, false, true];

function HizmetPaneli() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('');
  const wd = new Intl.DateTimeFormat(currentLang() === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short' });
  const today = new Date();

  return (
    <Screen>
      <Header title={t('panel.title')} />
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        {[[t('panel.earnings'), '₺48.600'], [t('panel.pendingOffers'), String(REQS.length - sent.length)], [t('panel.rating'), '4.9']].map(([k, v]) => (
          <Card key={k} style={{ flex: 1 }}>
            <T variant="caption" color={colors.muted}>{k}</T>
            <T variant="h2" color={colors.primary}>{v}</T>
          </Card>
        ))}
      </View>

      <Section title={t('panel.incoming')}>
        {REQS.map((r) => (
          <Card key={r}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
              <Icon name="wrench" size={18} color={colors.primary} />
              <T style={{ flex: 1 }}>{t(`panel.${r}`)}</T>
              {sent.includes(r) ? <StatusLine text={t('panel.sent')} />
                : <Button small title={t('panel.giveOffer')} onPress={() => setOpen(open === r ? null : r)} />}
            </View>
            {open === r ? (
              <View style={{ gap: space(2) }}>
                <View style={{ flexDirection: 'row', gap: space(2) }}>
                  <View style={{ flex: 1 }}><Field label={t('panel.price')} value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, ''))} keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Field label={t('panel.days')} value={days} onChangeText={(v) => setDays(v.replace(/\D/g, ''))} keyboardType="numeric" /></View>
                </View>
                <Button small title={t('panel.send')} disabled={!price || !days} onPress={() => {
                  setSent((s) => [...s, r]); setOpen(null); setPrice(''); setDays(''); showDemoToast(t('panel.sent'));
                }} />
              </View>
            ) : null}
          </Card>
        ))}
      </Section>

      <Section title={t('panel.calendar')}>
        <View style={{ flexDirection: 'row', gap: space(1.5) }}>
          {WEEK.map((busy, i) => {
            const d = new Date(today); d.setDate(today.getDate() + i);
            return (
              <View key={i} style={{ flex: 1, borderRadius: radius.sm, padding: space(2), alignItems: 'center', backgroundColor: busy ? colors.primary : colors.card, borderWidth: 1, borderColor: colors.line }}>
                <T variant="caption" color={busy ? colors.white : colors.muted} style={{ fontSize: 10 }}>{wd.format(d)}</T>
                <T variant="caption" color={busy ? colors.white : colors.text} style={{ fontFamily: fonts.bodyBold }}>{d.getDate()}</T>
                <T variant="caption" color={busy ? colors.white : colors.muted} style={{ fontSize: 9 }}>{busy ? t('panel.busy') : t('panel.free')}</T>
              </View>
            );
          })}
        </View>
      </Section>

      <Section title={t('panel.myDocs')}>
        <Card>
          {[{ name: t('verify.doc.vergi'), days: 420 }, { name: t('verify.doc.ustalik'), days: 20 }].map((d) => (
            <View key={d.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(1.5) }}>
              <Icon name="doc" size={18} color={d.days < 30 ? colors.warning : colors.success} />
              <View style={{ flex: 1 }}>
                <T>{d.name}</T>
                <T variant="caption" color={d.days < 30 ? colors.warning : colors.muted}>{t('panel.expiresIn', { days: d.days })}</T>
              </View>
              {d.days < 30 ? <Button small variant="secondary" title={t('panel.renew')} onPress={() => showDemoToast()} /> : null}
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

export default function Hizmet() {
  const mode = useMode((s) => s.mode);
  return mode === 'api' ? <ApiPanel /> : <HizmetPaneli />;
}

/** Gerçek mod: hizmet veren profilleri (usta/kaptan), gelen işler ve teklifler, kaptan rezervasyonları. */
function ApiPanel() {
  const { t } = useTranslation();
  const { data, reload } = useRemote(() => actions.myProviders());
  const { data: reqs } = useRemote(() => actions.myVerificationRequests());
  const [editing, setEditing] = useState<'usta' | 'kaptan' | null>(null);
  if (!data) return <Screen><Header title={t('panel.title')} /></Screen>;
  const usta = data.find((p) => p.kind === 'usta');
  const kaptan = data.find((p) => p.kind === 'kaptan');
  return (
    <Screen>
      <Header title={t('panel.title')} />
      {editing ? <ProfileForm kind={editing} current={editing === 'usta' ? usta : kaptan} onDone={() => { setEditing(null); reload(); }} /> : null}
      {!editing && !data.length ? (
        <Card>
          <T variant="h3">{t('panel.becomeTitle')}</T>
          <T color={colors.muted}>{t('panel.becomeBody')}</T>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <View style={{ flex: 1 }}><Button title={t('panel.becomeUsta')} onPress={() => setEditing('usta')} /></View>
            <View style={{ flex: 1 }}><Button variant="secondary" title={t('panel.becomeKaptan')} onPress={() => setEditing('kaptan')} /></View>
          </View>
        </Card>
      ) : null}
      {!editing ? data.map((p) => (
        <Card key={p.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name={p.kind === 'usta' ? 'wrench' : 'compass'} size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <T variant="h3">{p.name}</T>
              <T variant="caption" color={p.status === 'active' ? colors.success : colors.warning}>{t(`panel.status.${p.status ?? 'pending'}`)}{p.rating ? ` · ★ ${p.rating} (${p.reviewCount})` : ''}</T>
            </View>
            <Button small variant="ghost" title={t('panel.edit')} onPress={() => setEditing(p.kind)} />
          </View>
          {p.status === 'pending' ? (() => {
            // En yeni belge başvurusu: incelemedeyse bekler, reddedildiyse gerekçe ve yeniden yükleme.
            const r = reqs?.find((x) => x.kind === p.kind);
            if (r?.status === 'pending') return <T variant="caption" color={colors.muted}>{t('panel.docInReview')}</T>;
            return (
              <View style={{ gap: space(2) }}>
                {r?.status === 'rejected'
                  ? <T variant="caption" color={colors.danger}>{t('panel.docRejected', { reason: t(`mine.rejectReasons.${r.rejectReason ?? 'rules'}`) })}{r.rejectNote ? ` · ${r.rejectNote}` : ''}</T>
                  : <T variant="caption" color={colors.muted}>{t('panel.pendingNote')}</T>}
                <Button small variant="secondary" icon="doc" title={t('panel.uploadDocs')} onPress={() => router.push('/verify/professional')} />
              </View>
            );
          })() : null}
        </Card>
      )) : null}
      {!editing && data.length && !usta ? <Button variant="ghost" title={t('panel.becomeUsta')} onPress={() => setEditing('usta')} /> : null}
      {!editing && data.length && !kaptan ? <Button variant="ghost" title={t('panel.becomeKaptan')} onPress={() => setEditing('kaptan')} /> : null}
      {!editing && usta?.status === 'active' ? <UstaInbox /> : null}
      {!editing && kaptan ? <CaptainInbox /> : null}
    </Screen>
  );
}

const list = (s: string) => s.split(',').map((x) => x.trim()).filter((x) => x.length >= 2);

function ProfileForm({ kind, current, onDone }: { kind: 'usta' | 'kaptan'; current?: ApiProvider; onDone: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    displayName: current?.name ?? '', region: current?.region ?? '', bio: current?.bio ?? '', priceNote: current?.priceNote ?? '', yearsExp: String(current?.yearsExp ?? ''),
    dayRate: String(current?.dayRateEur ?? ''), weekRate: String(current?.weekRateEur ?? ''), languages: (current?.languages ?? []).join(', '), areas: (current?.areas ?? []).join(', '),
  });
  const [cats, setCats] = useState<UstaCategory[]>((current?.categories ?? []) as UstaCategory[]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.displayName.trim().length >= 2 && f.region.trim().length >= 2 && (kind === 'usta' ? cats.length > 0 : Number(f.dayRate) > 0);
  const save = async () => {
    setBusy(true);
    const body = {
      displayName: f.displayName.trim(), region: f.region.trim(), bio: f.bio.trim(), priceNote: f.priceNote.trim(), yearsExp: Number(f.yearsExp) || 0,
      languages: list(f.languages), areas: list(f.areas),
      ...(kind === 'usta' ? { categories: cats } : { dayRateEur: Number(f.dayRate), ...(Number(f.weekRate) > 0 ? { weekRateEur: Number(f.weekRate) } : {}) }),
    };
    const r = await attempt(() => actions.saveProvider(kind, body));
    setBusy(false);
    if (r) onDone();
  };
  return (
    <Card>
      <T variant="h3">{t(kind === 'usta' ? 'panel.ustaProfile' : 'panel.kaptanProfile')}</T>
      <Field label={t('panel.displayName')} required value={f.displayName} onChangeText={set('displayName')} maxLength={60} />
      <Field label={t('panel.region')} required value={f.region} onChangeText={set('region')} maxLength={40} placeholder="Bodrum" />
      {kind === 'usta' ? (
        <Section title={t('panel.categories')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {USTA_CATEGORIES.map((c) => <Chip key={c} label={t(`usta.cat.${c}`)} selected={cats.includes(c)} onPress={() => setCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))} />)}
          </View>
        </Section>
      ) : (
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <View style={{ flex: 1 }}><Field label={t('panel.dayRate')} required value={f.dayRate} onChangeText={(v) => set('dayRate')(v.replace(/\D/g, ''))} keyboardType="numeric" /></View>
          <View style={{ flex: 1 }}><Field label={t('panel.weekRate')} value={f.weekRate} onChangeText={(v) => set('weekRate')(v.replace(/\D/g, ''))} keyboardType="numeric" /></View>
        </View>
      )}
      <Field label={t('panel.yearsExp')} value={f.yearsExp} onChangeText={(v) => set('yearsExp')(v.replace(/\D/g, '').slice(0, 2))} keyboardType="numeric" />
      <Field label={t('panel.bio')} value={f.bio} onChangeText={set('bio')} multiline maxLength={1000} />
      <Field label={t('panel.priceNote')} value={f.priceNote} onChangeText={set('priceNote')} maxLength={120} />
      {kind === 'kaptan' ? <Field label={t('panel.languages')} value={f.languages} onChangeText={set('languages')} hint={t('panel.commaHint')} /> : null}
      <Field label={t('panel.areas')} value={f.areas} onChangeText={set('areas')} hint={t('panel.commaHint')} />
      <Button title={t('panel.saveProfile')} loading={busy} disabled={!valid} onPress={save} />
      <Button variant="ghost" title={t('common.cancel')} onPress={onDone} />
    </Card>
  );
}

/** Usta: alanındaki açık işler (teklif ver) ve teklif verdiği işler. */
function UstaInbox() {
  const { t } = useTranslation();
  const { data, reload } = useRemote(() => actions.providerJobs());
  const [open, setOpen] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [q, setQ] = useState({ price: '', days: '', note: '' });
  const lang = currentLang();
  const send = async (job: ApiJob) => {
    const r = await attempt(() => actions.sendQuote(job.id, { priceTry: Number(q.price), days: Number(q.days), note: q.note.trim() }));
    if (r !== undefined) { setOpen(null); setQ({ price: '', days: '', note: '' }); showDemoToast(t('panel.sent')); reload(); }
  };
  return (
    <>
      <Section title={t('panel.incoming')}>
        {data && !data.open.length ? <EmptyState icon="wrench" title={t('panel.noJobs')} /> : null}
        {(data?.open ?? []).map((j) => (
          <Card key={j.id}>
            <T variant="h3">{j.title}</T>
            <T variant="caption" color={colors.muted}>{t(`usta.cat.${j.category}`)}{j.region ? ` · ${j.region}` : ''}</T>
            <T>{j.description}</T>
            {open === j.id ? (
              <View style={{ gap: space(2) }}>
                <View style={{ flexDirection: 'row', gap: space(2) }}>
                  <View style={{ flex: 1 }}><Field label={t('panel.price')} value={q.price} onChangeText={(v) => setQ((s) => ({ ...s, price: v.replace(/\D/g, '') }))} keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Field label={t('panel.days')} value={q.days} onChangeText={(v) => setQ((s) => ({ ...s, days: v.replace(/\D/g, '') }))} keyboardType="numeric" /></View>
                </View>
                <Field label={t('panel.note')} value={q.note} onChangeText={(v) => setQ((s) => ({ ...s, note: v }))} maxLength={500} />
                <Button small title={t('panel.send')} disabled={!(Number(q.price) >= 100) || !(Number(q.days) >= 1)} onPress={() => send(j)} />
              </View>
            ) : <Button small title={t('panel.giveOffer')} onPress={() => setOpen(j.id)} />}
          </Card>
        ))}
      </Section>
      {data?.quoted.length ? (
        <Section title={t('panel.myQuotes')}>
          {data.quoted.map((j) => (
            <Card key={j.id}>
              <T variant="h3">{j.title}</T>
              <T variant="caption" color={colors.muted}>{t(`panel.jobStatus.${j.status}`)} · {j.quotes[0] ? formatPrice(j.quotes[0].priceTry, 'TRY', lang) : ''}</T>
              {j.acceptedQuoteId && j.quotes.some((x) => x.id === j.acceptedQuoteId) ? <StatusLine text={t('panel.won')} /> : null}
              {/* Kabul edilmiş ama ödenmemiş iş: usta çekilebilir (iş yeniden teklife açılır). */}
              {j.status === 'accepted' && j.quotes.some((x) => x.id === j.acceptedQuoteId) ? (
                withdrawing === j.id ? (
                  <View style={{ gap: space(2) }}>
                    <T variant="caption">{t('panel.withdrawConfirm')}</T>
                    <View style={{ flexDirection: 'row', gap: space(2) }}>
                      <View style={{ flex: 1 }}><Button small variant="secondary" title={t('common.cancel')} onPress={() => setWithdrawing(null)} /></View>
                      <View style={{ flex: 1 }}><Button small title={t('panel.withdraw')} onPress={async () => { await attempt(() => actions.withdrawQuote(j.id)); setWithdrawing(null); reload(); }} /></View>
                    </View>
                  </View>
                ) : <Button small variant="ghost" title={t('panel.withdraw')} onPress={() => setWithdrawing(j.id)} />
              ) : null}
              {j.status === 'paid' && j.quotes.some((x) => x.id === j.acceptedQuoteId) ? (j.deliveredAt
                ? <T variant="caption" color={colors.muted}>{t('panel.delivered')}</T>
                : <Button small icon="check" title={t('panel.markDelivered')} onPress={async () => { await attempt(() => actions.markDelivered(j.id)); reload(); }} />) : null}
            </Card>
          ))}
        </Section>
      ) : null}
    </>
  );
}

/** Kaptan: gelen rezervasyonlar; ödenmemiş talep geri çevrilebilir. */
function CaptainInbox() {
  const { t } = useTranslation();
  const { data, reload } = useRemote(() => actions.providerBookings());
  const lang = currentLang();
  return (
    <Section title={t('panel.bookings')}>
      {data && !data.length ? <EmptyState icon="calendar" title={t('panel.noBookings')} /> : null}
      {(data ?? []).map((b) => (
        <Card key={b.id}>
          <T variant="h3">{t('captain.selected', { start: b.start, count: b.days })}</T>
          <T variant="caption" color={colors.muted}>{t(`panel.bookingStatus.${b.status}`)} · {formatPrice(b.totalEur, 'EUR', lang)}</T>
          {b.status === 'requested' ? <Button small variant="ghost" title={t('panel.decline')} onPress={async () => { await attempt(() => actions.declineBooking(b.id)); reload(); }} /> : null}
        </Card>
      ))}
    </Section>
  );
}
