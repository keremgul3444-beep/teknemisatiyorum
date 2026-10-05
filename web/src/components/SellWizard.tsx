'use client';
import { useEffect, useRef, useState } from 'react';
import { BOAT_TYPES, CURRENCIES, EQUIPMENT, LOCATIONS, type Equipment } from '@tms/shared';
import {
  MAX_LISTING_PHOTOS, SELL_STEPS, changedDraft, describeFacts, digits, emptySell, firstInvalid, move, restoreSell, toCover, toDraft, validateSell, type SellErrors, type SellFields,
} from '@/lib/listingForm';

type Dict = Record<string, string>;
/** Yeni seçilen fotoğrafın dosyası var; düzenlemede sunucudaki fotoğrafın yalnızca kimliği. */
type Photo = { key: string; url: string; file?: File; fileId?: string };
/** Düzenleme modu: var olan ilan, alanları ve fotoğraflarıyla. */
export type SellEdit = { id: string; status: string; fields: SellFields; photos: { id: string; url: string }[] };
const DRAFT_KEY = 'tms.sell.draft';

/**
 * Siteden ilan verme: fotoğraflar → bilgiler → donanım → fiyat ve konum → kontrol. Kimliği doğrulanmamış satıcı
 * gönderimden önce T.C. kimliğini doğrular. Alanlar sekmede saklanır (fotoğraflar hariç). Gönderim sırası:
 * taslak aç → fotoğrafları yükle → fotoğraf listesini ayarla → onaya gönder; yarıda kalırsa aynı taslaktan sürer.
 * Düzenlemede yalnızca değişen alanlar gönderilir; yalnızca fiyat değişirse ilan yeniden onaya düşmez, reddedilmiş ilan
 * düzeltilince yeniden onaya gönderilir.
 */
export function SellWizard({ L, err, errors, types, equipment, verified, doneHref, companies = [], edit }: {
  L: Dict; err: Dict; errors: Dict; types: Dict; equipment: Dict; verified: boolean; doneHref: string;
  edit?: SellEdit;
  /** Kullanıcının üyesi olduğu firmalar: ilan firma adına verilebilir. */
  companies?: { id: string; name: string }[];
}) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<SellFields>(() => edit?.fields ?? emptySell());
  const [photos, setPhotos] = useState<Photo[]>(() => edit?.photos.map((p) => ({ key: p.id, url: p.url, fileId: p.id })) ?? []);
  const [shown, setShown] = useState<SellErrors>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [isVerified, setVerified] = useState(verified);
  const [idf, setIdf] = useState({ tckn: '', firstName: '', lastName: '', birthYear: '' });
  const [done, setDone] = useState(false);
  const [writing, setWriting] = useState(false);
  const [writeNote, setWriteNote] = useState('');
  // Yarıda kalan gönderim: açılan taslak ve yüklenen fotoğraflar tekrar denemede yeniden kullanılır.
  const server = useRef<{ id?: string; uploaded: Map<string, string> }>({ uploaded: new Map() });
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || edit) return;
    restored.current = true;
    try {
      const back = restoreSell(sessionStorage.getItem(DRAFT_KEY));
      // Saklanan taslak ilk çizimden sonra yüklenir (sunucu çiziminde sessionStorage yok).
      if (back) queueMicrotask(() => setF(back));
    } catch { /* gizli sekme: taslak saklanmaz */ }
  }, []);
  useEffect(() => {
    if (edit) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f)); } catch { /* yoksay */ }
  }, [f, edit]);
  useEffect(() => () => photos.forEach((p) => p.file && URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof SellFields>(k: K, v: SellFields[K]) => setF((s) => ({ ...s, [k]: v }));
  const msg = (key?: string) => errors[String(key ?? '').replace(/^errors\./, '')] ?? errors.generic;
  const fieldErr = (k: keyof SellErrors) => (shown[k] ? err[shown[k]!] : '');

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_LISTING_PHOTOS - photos.length;
    const add = [...list].filter((x) => /^image\//.test(x.type)).slice(0, room).map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, url: URL.createObjectURL(file) }));
    setPhotos((p) => [...p, ...add]);
    setShown((s) => ({ ...s, photos: undefined }));
  };
  const removePhoto = (i: number) => setPhotos((p) => { if (p[i].file) URL.revokeObjectURL(p[i].url); return p.filter((_, k) => k !== i); });

  const next = () => {
    const e = validateSell(step, f, photos.length);
    setShown(e);
    if (Object.keys(e).length) return;
    setStep((s) => Math.min(s + 1, SELL_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => { setShown({}); setStep((s) => Math.max(0, s - 1)); };

  const post = async (url: string, init: RequestInit) => {
    const r = await fetch(url, init).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) throw new Error(r ? msg(j.messageKey) : errors.network ?? errors.generic);
    return j;
  };
  const json = (body: unknown, method = 'POST'): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  /** Açıklama taslağı: kutudaki yazı not olarak gider, dönen taslak kutuya yazılır (satıcı düzenler). */
  const writeDescription = async () => {
    const facts = describeFacts(f);
    if (!facts) { setWriteNote(L.writeNeeds); return; }
    setWriting(true); setWriteNote('');
    try {
      const j = await post('/api/sell/describe', json(facts));
      set('description', String(j.text ?? '').slice(0, 4000));
      setWriteNote(j.source === 'llm' ? L.writeDoneLlm : L.writeDoneRules);
    } catch (e) {
      setWriteNote((e as Error).message);
    } finally {
      setWriting(false);
    }
  };

  const verifyIdentity = async () => {
    setBusy(true); setError('');
    try {
      await post('/api/sell/identity', json({ tckn: digits(idf.tckn), firstName: idf.firstName.trim(), lastName: idf.lastName.trim(), birthYear: Number(idf.birthYear) }));
      setVerified(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  /** Yeni fotoğrafları yükler (yarıda kalan denemede yüklenenler tekrar gönderilmez); tam kimlik listesi sırasıyla. */
  const uploadAll = async () => {
    const s = server.current;
    const fresh = photos.filter((p) => !p.fileId).length;
    let n = 0;
    const ids: string[] = [];
    for (const p of photos) {
      if (p.fileId) { ids.push(p.fileId); continue; }
      setProgress(L.uploading.replace('{{n}}', String(++n)).replace('{{total}}', String(fresh)));
      let id = s.uploaded.get(p.key);
      if (!id) {
        const form = new FormData();
        form.set('file', p.file!);
        id = (await post('/api/sell/media', { method: 'POST', body: form })).id as string;
        s.uploaded.set(p.key, id);
      }
      ids.push(id);
    }
    return ids;
  };

  const publish = async () => {
    const bad = firstInvalid(f, photos.length);
    if (bad >= 0) { setStep(bad); setShown(validateSell(bad, f, photos.length)); return; }
    setBusy(true); setError('');
    try {
      if (edit) {
        const changes = changedDraft(edit.fields, f);
        if (Object.keys(changes).length) await post(`/api/sell/${edit.id}`, json(changes, 'PATCH'));
        const ids = await uploadAll();
        setProgress(L.sending);
        if (JSON.stringify(ids) !== JSON.stringify(edit.photos.map((p) => p.id))) await post(`/api/sell/${edit.id}/photos`, json({ fileIds: ids }, 'PUT'));
        // Reddedilmiş ilan düzeltildi: yeniden onaya gönderilir (zaten onaydaysa sunucu 409 döner, sorun değil).
        if (edit.status === 'rejected') await post(`/api/sell/${edit.id}/submit`, { method: 'POST' }).catch(() => null);
        setDone(true);
        return;
      }
      const s = server.current;
      if (!s.id) s.id = (await post('/api/sell', json(toDraft(f)))).id as string;
      const ids = await uploadAll();
      setProgress(L.sending);
      await post(`/api/sell/${s.id}/photos`, json({ fileIds: ids }, 'PUT'));
      await post(`/api/sell/${s.id}/submit`, { method: 'POST' });
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* yoksay */ }
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false); setProgress('');
    }
  };

  if (done) {
    return (
      <div className="card" style={{ display: 'grid', gap: 12 }} role="status">
        <h2>{edit ? L.editDoneTitle : L.doneTitle}</h2>
        <p className="muted">{edit ? L.editDoneBody : L.doneBody}</p>
        <a className="btn" href={doneHref}>{L.toListings}</a>
      </div>
    );
  }

  const input = (k: keyof SellFields, label: string, o: { required?: boolean; inputMode?: 'numeric' | 'decimal'; placeholder?: string; max?: number; error?: keyof SellErrors } = {}) => {
    const e = o.error ? fieldErr(o.error) : '';
    const id = `sell-${k}`;
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <label htmlFor={id}>{label}{o.required ? <span aria-hidden="true" style={{ color: 'var(--c-danger)' }}> *</span> : null}</label>
        <input id={id} className="input" value={String(f[k])} inputMode={o.inputMode} placeholder={o.placeholder} maxLength={o.max} required={o.required}
          aria-invalid={e ? true : undefined} aria-describedby={e ? `${id}-err` : undefined}
          onChange={(ev) => set(k, (o.inputMode === 'numeric' ? digits(ev.target.value) : ev.target.value) as never)} />
        {e ? <span id={`${id}-err`} className="small" style={{ color: 'var(--c-danger)' }}>{e}</span> : null}
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ol className="row small" aria-label={L.progress} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {SELL_STEPS.map((s, i) => (
          <li key={s} className="chip" aria-current={i === step ? 'step' : undefined} style={i === step ? { borderColor: 'var(--c-primary)', color: 'var(--c-primary)' } : undefined}>
            {i + 1}. {L[`step_${s}`]}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="card" style={{ display: 'grid', gap: 12 }}>
          <h2>{L.step_photos}</h2>
          <p className="muted small">{L.photosHint} {L.photosCount.replace('{{n}}', String(photos.length)).replace('{{max}}', String(MAX_LISTING_PHOTOS))}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {photos.map((p, i) => (
              <figure key={p.key} style={{ margin: 0, display: 'grid', gap: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={i === 0 ? L.photoCover.replace('{{n}}', '1') : L.photoN.replace('{{n}}', String(i + 1))}
                  style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 10, border: i === 0 ? '3px solid var(--c-primary)' : '1px solid var(--c-line)' }} />
                {i === 0 ? <span className="small" style={{ color: 'var(--c-primary)', fontWeight: 700 }}>{L.cover}</span> : null}
                <div className="row small">
                  {i > 0 ? <button type="button" className="linklike" onClick={() => setPhotos((x) => toCover(x, i))}>{L.makeCover}</button> : null}
                  <button type="button" className="linklike" aria-label={L.moveLeft} disabled={i === 0} onClick={() => setPhotos((x) => move(x, i, -1))}>←</button>
                  <button type="button" className="linklike" aria-label={L.moveRight} disabled={i === photos.length - 1} onClick={() => setPhotos((x) => move(x, i, 1))}>→</button>
                  <button type="button" className="linklike" onClick={() => removePhoto(i)}>{L.remove}</button>
                </div>
              </figure>
            ))}
          </div>
          {photos.length < MAX_LISTING_PHOTOS ? (
            <label className="btn ghost" style={{ justifySelf: 'start' }}>
              {L.addPhotos}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
          ) : null}
          {shown.photos ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{err.photos}</p> : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="card" style={{ display: 'grid', gap: 12 }}>
          <h2>{L.step_basics}</h2>
          <div className="grid" style={{ gap: 12 }}>
            {input('brand', L.brand, { required: true, placeholder: L.brandPh, max: 60, error: 'brand' })}
            {input('model', L.model, { required: true, placeholder: L.modelPh, max: 60, error: 'model' })}
            {input('year', L.year, { required: true, inputMode: 'numeric', max: 4, error: 'year' })}
            {input('length', L.length, { required: true, inputMode: 'decimal', placeholder: '12,4', max: 6, error: 'length' })}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="sell-type">{L.type}<span aria-hidden="true" style={{ color: 'var(--c-danger)' }}> *</span></label>
            <select id="sell-type" className="input" value={f.type} required aria-invalid={shown.type ? true : undefined} onChange={(e) => set('type', e.target.value as SellFields['type'])}>
              <option value="">{L.choose}</option>
              {BOAT_TYPES.map((x) => <option key={x} value={x}>{types[x]}</option>)}
            </select>
            {shown.type ? <span className="small" style={{ color: 'var(--c-danger)' }}>{err.type}</span> : null}
          </div>
          <div className="grid" style={{ gap: 12 }}>
            {input('cabins', L.cabins, { inputMode: 'numeric', max: 2 })}
            {input('engine', L.engine, { placeholder: L.enginePh, max: 80 })}
            {input('engineHours', L.engineHours, { inputMode: 'numeric', max: 6, error: 'engineHours' })}
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="sell-flag">{L.flag}</label>
              <select id="sell-flag" className="input" value={f.flag} onChange={(e) => set('flag', e.target.value as SellFields['flag'])}>
                <option value="">{L.choose}</option>
                <option value="tr">{L.flagTr}</option>
                <option value="foreign">{L.flagForeign}</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="sell-desc">{L.description}</label>
            <textarea id="sell-desc" className="input" rows={5} maxLength={4000} placeholder={L.descriptionPh} value={f.description} onChange={(e) => set('description', e.target.value)} />
            <div className="row small" style={{ alignItems: 'center' }}>
              <button type="button" className="btn ghost" disabled={writing} onClick={() => void writeDescription()}>{writing ? L.writing : L.writeForMe}</button>
              <span className="muted" role="status">{writeNote || L.writeHint}</span>
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="card" style={{ display: 'grid', gap: 12 }}>
          <h2>{L.step_equipment}</h2>
          <div className="row">
            {EQUIPMENT.map((x) => (
              <label key={x} className="chip" style={{ gap: 8 }}>
                <input type="checkbox" checked={f.equipment.includes(x)}
                  onChange={(e) => set('equipment', e.target.checked ? [...f.equipment, x] : f.equipment.filter((y: Equipment) => y !== x))} />
                {equipment[x]}
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="card" style={{ display: 'grid', gap: 12 }}>
          <h2>{L.step_price}</h2>
          <div className="row" style={{ alignItems: 'end', flexWrap: 'nowrap' }}>
            <div style={{ flex: 1 }}>{input('price', L.price, { required: true, inputMode: 'numeric', max: 10, error: 'price' })}</div>
            <select className="input" aria-label={L.currency} value={f.currency} style={{ width: 100 }} onChange={(e) => set('currency', e.target.value as SellFields['currency'])}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label htmlFor="sell-loc">{L.location}<span aria-hidden="true" style={{ color: 'var(--c-danger)' }}> *</span></label>
            <select id="sell-loc" className="input" value={f.location} required aria-invalid={shown.location ? true : undefined} onChange={(e) => set('location', e.target.value)}>
              <option value="">{L.choose}</option>
              {LOCATIONS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            {shown.location ? <span className="small" style={{ color: 'var(--c-danger)' }}>{err.location}</span> : null}
          </div>
          {companies.length && !edit ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="sell-company">{L.seller}</label>
              <select id="sell-company" className="input" value={companies.some((c) => c.id === f.companyId) ? f.companyId : ''} onChange={(e) => set('companyId', e.target.value)}>
                <option value="">{L.sellerSelf}</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : null}
          <label className="row"><input type="checkbox" checked={f.tradeIn} onChange={(e) => set('tradeIn', e.target.checked)} /> {L.tradeIn}</label>
          <label className="row"><input type="checkbox" checked={f.negotiable} onChange={(e) => set('negotiable', e.target.checked)} /> {L.negotiable}</label>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="card" style={{ display: 'grid', gap: 12 }}>
          <h2>{L.step_review}</h2>
          <dl className="small" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 16px', margin: 0 }}>
            <dt className="muted">{L.boat}</dt><dd style={{ margin: 0 }}>{f.brand} {f.model} · {f.year} · {f.length} m · {f.type ? types[f.type] : ''}</dd>
            <dt className="muted">{L.price}</dt><dd style={{ margin: 0 }}>{Number(digits(f.price)).toLocaleString()} {f.currency}</dd>
            <dt className="muted">{L.location}</dt><dd style={{ margin: 0 }}>{f.location}</dd>
            <dt className="muted">{L.step_photos}</dt><dd style={{ margin: 0 }}>{photos.length}</dd>
          </dl>
          <p className="notice small">{L.reviewNote}</p>
          {!isVerified ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <h3>{L.idTitle}</h3>
              <p className="muted small">{L.idBody}</p>
              <div className="grid" style={{ gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>{L.tckn}<input className="input" inputMode="numeric" autoComplete="off" maxLength={11} value={idf.tckn} onChange={(e) => setIdf((s) => ({ ...s, tckn: digits(e.target.value) }))} /></label>
                <label style={{ display: 'grid', gap: 6 }}>{L.firstName}<input className="input" autoComplete="given-name" value={idf.firstName} onChange={(e) => setIdf((s) => ({ ...s, firstName: e.target.value }))} /></label>
                <label style={{ display: 'grid', gap: 6 }}>{L.lastName}<input className="input" autoComplete="family-name" value={idf.lastName} onChange={(e) => setIdf((s) => ({ ...s, lastName: e.target.value }))} /></label>
                <label style={{ display: 'grid', gap: 6 }}>{L.birthYear}<input className="input" inputMode="numeric" maxLength={4} value={idf.birthYear} onChange={(e) => setIdf((s) => ({ ...s, birthYear: digits(e.target.value) }))} /></label>
              </div>
              <button type="button" className="btn" disabled={busy || idf.tckn.length !== 11 || !idf.firstName.trim() || !idf.lastName.trim() || idf.birthYear.length !== 4} onClick={() => void verifyIdentity()}>{L.verify}</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
      {progress ? <p className="small muted" role="status" style={{ margin: 0 }}>{progress}</p> : null}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        {step > 0 ? <button type="button" className="btn ghost" disabled={busy} onClick={back}>{L.back}</button> : <span />}
        {step < SELL_STEPS.length - 1
          ? <button type="button" className="btn" onClick={next}>{L.next}</button>
          : <button type="button" className="btn" disabled={busy || !isVerified} onClick={() => void publish()}>{edit ? L.saveEdit : L.publish}</button>}
      </div>
    </div>
  );
}
