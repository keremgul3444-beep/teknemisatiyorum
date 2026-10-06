import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '@/theme';
import { router } from 'expo-router';
import { Avatar, BoatImage, Button, Card, Chip, EmptyState, Field, Header, Icon, ListingCard, Screen, Section, T, showDemoToast } from '@/components';
import { actions, formatPrice, useCompanies, useListings } from '@/services';
import { isApiMode, useMode } from '@/services/mode';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';
import { currentLang } from '@/i18n';
import { canRemove, isManager, toPhone, type CompanyDetail } from '@/features/company';

function KurumsalPanel() {
  const { t } = useTranslation();
  const company = useCompanies()[0];
  const all = useListings();
  const listings = all.filter((l) => company.listingIds.includes(l.id));
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Screen>
      <Header title={t('corporate.title')} />
      <Card padded={false}>
        <BoatImage seed={4} height={90} />
        <View style={{ padding: space(4), flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
          <Avatar name={company.name} size={52} />
          <View style={{ flex: 1 }}>
            <T variant="h2">{company.name}</T>
            <T variant="caption" color={colors.muted}>{t(`corporate.kind.${company.kind}`)} · {company.city}</T>
          </View>
        </View>
      </Card>

      <Section title={t('corporate.staff')} actionLabel={t('corporate.invite')} onAction={() => showDemoToast(t('corporate.invited'))}>
        <Card>
          {company.staff.map((s) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(1) }}>
              <Avatar name={s} size={34} /><T>{s}</T>
            </View>
          ))}
        </Card>
      </Section>

      <Section title={t('corporate.listings')}>
        {listings.map((l) => (
          <View key={l.id} style={{ gap: space(2) }}>
            <Pressable onPress={() => toggle(l.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <View style={{ width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: sel.includes(l.id) ? colors.primary : colors.card, alignItems: 'center', justifyContent: 'center' }}>
                {sel.includes(l.id) ? <Icon name="check" size={14} color={colors.white} /> : null}
              </View>
              <T variant="caption" color={colors.muted}>{l.brand} {l.model}</T>
            </Pressable>
            <ListingCard listing={l} compact />
          </View>
        ))}
        <Button icon="sparkle" title={t('corporate.feature', { count: sel.length })} disabled={!sel.length}
          onPress={() => { showDemoToast(t('corporate.featured', { count: sel.length })); setSel([]); }} />
      </Section>
    </Screen>
  );
}

/** Gerçek mod: sunucudaki firma (yoksa açma formu), personel ve firmanın ilanları. Birden çok firmada üstte seçim. */
function ApiPanel() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const { data, reload } = useRemote(async () => {
    const mine = await actions.myCompanies();
    // Sarmalanır: `null` yükleniyor demek, `{ company: null }` firma yok demek.
    return { mine, company: mine.length ? await actions.companyDetail(mine[0].id) : null };
  });
  // Seçilen firma ayrıca yüklenir (ilk firma listeyle birlikte gelir).
  const other = useRemote(async () => (selected ? actions.companyDetail(selected) : null));
  const { reload: reloadOther } = other;
  useEffect(() => { if (selected) void reloadOther(); }, [selected, reloadOther]);
  const company = selected && other.data?.id === selected ? other.data : data?.company ?? null;
  return (
    <Screen>
      <Header title={t('corporate.title')} />
      {data && data.mine.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {data.mine.map((c) => <Chip key={c.id} label={c.name} selected={(company?.id ?? data.mine[0].id) === c.id} onPress={() => setSelected(c.id)} />)}
        </View>
      ) : null}
      {!data ? null : company ? <CompanyView d={company} reload={() => { void reload(); if (selected) void reloadOther(); }} /> : <CreateCompany onCreated={reload} />}
    </Screen>
  );
}

function CreateCompany({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: '', kind: 'galeri' as CompanyDetail['kind'], city: '' });
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <T variant="h2">{t('corporate.createTitle')}</T>
      <T variant="caption" color={colors.muted}>{t('corporate.createBody')}</T>
      <Field label={t('corporate.name')} required value={f.name} onChangeText={(v) => setF((s) => ({ ...s, name: v }))} maxLength={80} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {(['galeri', 'broker', 'tersane', 'servis'] as const).map((k) => <Chip key={k} label={t(`corporate.kind.${k}`)} selected={f.kind === k} onPress={() => setF((s) => ({ ...s, kind: k }))} />)}
      </View>
      <Field label={t('corporate.city')} required value={f.city} onChangeText={(v) => setF((s) => ({ ...s, city: v }))} maxLength={40} />
      <Button title={t('corporate.create')} loading={busy} disabled={f.name.trim().length < 2 || f.city.trim().length < 2}
        onPress={async () => { setBusy(true); const r = await attempt(() => actions.createCompany(f)); setBusy(false); if (r) onCreated(); }} />
    </Card>
  );
}

function CompanyView({ d, reload }: { d: CompanyDetail; reload: () => void }) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [removing, setRemoving] = useState<string | null>(null);
  const full = toPhone(phone);
  return (
    <>
      <Card padded={false}>
        <View style={{ padding: space(4), flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
          <Avatar name={d.name} size={52} />
          <View style={{ flex: 1 }}>
            <T variant="h2">{d.name}</T>
            <T variant="caption" color={colors.muted}>{t(`corporate.kind.${d.kind}`)} · {d.city} · {t(`corporate.role.${d.myRole}`)}</T>
          </View>
        </View>
        {d.myRole !== 'owner' && isApiMode() ? (
          <View style={{ paddingHorizontal: space(4), paddingBottom: space(4), gap: space(2) }}>
            {leaving ? <T variant="caption">{t('corporate.leaveConfirm')}</T> : null}
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              {leaving ? <View style={{ flex: 1 }}><Button small variant="secondary" title={t('common.cancel')} onPress={() => setLeaving(false)} /></View> : null}
              <View style={{ flex: 1 }}><Button small variant={leaving ? 'danger' : 'ghost'} title={t('corporate.leave')}
                onPress={async () => { if (!leaving) return setLeaving(true); const ok = await attempt(async () => { await actions.leaveCompany(d.id); return true; }); if (ok) router.back(); }} /></View>
            </View>
          </View>
        ) : null}
      </Card>

      <Section title={t('corporate.staff')}>
        <Card>
          {d.members.map((m) => (
            <View key={m.userId} style={{ gap: space(2), paddingVertical: space(1) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
                <Avatar name={m.name ?? '—'} size={34} />
                <View style={{ flex: 1 }}>
                  <T>{m.name ?? '—'}</T>
                  <T variant="caption" color={colors.muted}>{m.phone} · {t(`corporate.role.${m.role}`)}</T>
                </View>
                {canRemove(d, m) && removing !== m.userId ? <Button small variant="ghost" title={t('corporate.remove')} onPress={() => setRemoving(m.userId)} /> : null}
              </View>
              {removing === m.userId ? (
                <View style={{ gap: space(2) }}>
                  <T variant="caption">{t('corporate.removeConfirm', { name: m.name ?? '—' })}</T>
                  <View style={{ flexDirection: 'row', gap: space(2) }}>
                    <View style={{ flex: 1 }}><Button small variant="secondary" title={t('common.cancel')} onPress={() => setRemoving(null)} /></View>
                    <View style={{ flex: 1 }}><Button small variant="danger" title={t('corporate.remove')}
                      onPress={async () => { await attempt(() => actions.removeCompanyMember(d.id, m.userId)); setRemoving(null); reload(); }} /></View>
                  </View>
                </View>
              ) : null}
            </View>
          ))}
          {isManager(d) ? (
            <View style={{ gap: space(2), marginTop: space(2) }}>
              <Field label={t('corporate.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="5xx xxx xx xx" hint={t('corporate.addHint')} />
              <View style={{ flexDirection: 'row', gap: space(2) }}>
                <Chip label={t('corporate.role.staff')} selected={role === 'staff'} onPress={() => setRole('staff')} />
                <Chip label={t('corporate.role.admin')} selected={role === 'admin'} onPress={() => setRole('admin')} />
              </View>
              <Button small title={t('corporate.add')} disabled={!full}
                onPress={async () => { const r = await attempt(() => actions.addCompanyMember(d.id, full!, role)); if (r !== undefined) { setPhone(''); reload(); } }} />
            </View>
          ) : null}
        </Card>
      </Section>

      {isApiMode() ? <Button variant="secondary" icon="doc" title={t('bulk.open')} onPress={() => router.push({ pathname: '/panel/toplu', params: { id: d.id } })} /> : null}
      <Section title={t('corporate.listings')}>
        {d.listings.length === 0 ? <EmptyState icon="anchor" title={t('corporate.noListings')} actionLabel={t('mine.post')} onAction={() => router.push('/ilan-ver')} /> : d.listings.map((l) => (
          <Card key={l.id}>
            <T variant="h3">{l.title} · {l.year}</T>
            <T variant="caption" color={colors.muted}>{formatPrice(l.price, l.currency, currentLang())} · {t(`corporate.status.${l.status}`, { defaultValue: l.status })} · {l.ownerName ?? '—'}</T>
            {l.stats ? <T variant="caption" color={colors.muted}>{t('corporate.stats', { v: l.stats.views, f: l.stats.favorites, m: l.stats.messages })}</T> : null}
            {/* Firma sahibi/yöneticisi personelin ilanını da düzenler ve öne çıkarır. */}
            {isManager(d) && !['sold', 'removed'].includes(l.status) ? (
              <View style={{ flexDirection: 'row', gap: space(2) }}>
                <View style={{ flex: 1 }}><Button small variant="secondary" title={t('mine.edit')} onPress={async () => { if (await attempt(async () => { await actions.loadOwnListing(l.id); return true; })) router.push({ pathname: '/ilan-ver', params: { id: l.id } }); }} /></View>
                {l.status === 'published' ? <View style={{ flex: 1 }}><Button small variant="ghost" title={t('promo.cta')} onPress={async () => { if (await attempt(async () => { await actions.loadOwnListing(l.id); return true; })) router.push(`/profil/one-cikar/${l.id}`); }} /></View> : null}
              </View>
            ) : null}
          </Card>
        ))}
      </Section>
    </>
  );
}

export default function Kurumsal() {
  const mode = useMode((s) => s.mode);
  return mode === 'api' ? <ApiPanel /> : <KurumsalPanel />;
}
