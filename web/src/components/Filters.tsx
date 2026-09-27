import { BOAT_TYPES, CURRENCIES, EQUIPMENT } from '@tms/shared';
import { localePath, t, type Locale } from '@/i18n';
import type { SearchState } from '@/lib/queries';

/** Arama filtreleri: düz GET formu (JavaScript'siz çalışır, adres paylaşılabilir). */
export function Filters({ locale, state, action }: { locale: Locale; state: SearchState; action?: string }) {
  const q = state.q;
  return (
    <form method="get" action={action ?? localePath(locale, '/ilanlar')} className="card" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
      <div>
        <label htmlFor="f-tip">{t(locale, 'filters.type')}</label>
        <select id="f-tip" name="tip" className="input" defaultValue={q.type ?? ''}>
          <option value="">{t(locale, 'filters.any')}</option>
          {BOAT_TYPES.map((b) => <option key={b} value={b}>{t(locale, `boatType.${b}`)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-sehir">{t(locale, 'filters.city')}</label>
        <input id="f-sehir" name="sehir" className="input" defaultValue={q.location ?? ''} maxLength={40} />
      </div>
      <div>
        <label htmlFor="f-minboy">{t(locale, 'filters.minLength')}</label>
        <input id="f-minboy" name="minBoy" className="input" inputMode="decimal" defaultValue={q.minLength ?? ''} />
      </div>
      <div>
        <label htmlFor="f-maxboy">{t(locale, 'filters.maxLength')}</label>
        <input id="f-maxboy" name="maxBoy" className="input" inputMode="decimal" defaultValue={q.maxLength ?? ''} />
      </div>
      <div>
        <label htmlFor="f-minyil">{t(locale, 'filters.minYear')}</label>
        <input id="f-minyil" name="minYil" className="input" inputMode="numeric" defaultValue={q.minYear ?? ''} />
      </div>
      <div>
        <label htmlFor="f-maxfiyat">{t(locale, 'filters.maxPrice')}</label>
        <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
          <input id="f-maxfiyat" name="maxFiyat" className="input" inputMode="numeric" defaultValue={q.maxPrice ?? ''} />
          <select name="para" className="input" style={{ width: 90 }} defaultValue={q.currency ?? 'EUR'} aria-label={t(locale, 'filters.currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="f-sira">{t(locale, 'filters.sort')}</label>
        <select id="f-sira" name="sira" className="input" defaultValue={state.sort}>
          <option value="new">{t(locale, 'filters.sortNew')}</option>
          <option value="asc">{t(locale, 'filters.sortAsc')}</option>
          <option value="desc">{t(locale, 'filters.sortDesc')}</option>
        </select>
      </div>
      <fieldset style={{ gridColumn: '1 / -1', border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted">{t(locale, 'filters.equipment')}</legend>
        <div className="row">
          {EQUIPMENT.map((e) => (
            <span key={e} className="chip">
              <input type="checkbox" id={`eq-${e}`} name="donanim" value={e} defaultChecked={q.equipment.includes(e)} />
              <span style={{ marginLeft: 6 }}><label htmlFor={`eq-${e}`} style={{ display: 'inline', textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'inherit', fontSize: 14 }}>{t(locale, `equipment.${e}`)}</label></span>
            </span>
          ))}
          <span className="chip">
            <input type="checkbox" id="f-acil" name="acil" value="1" defaultChecked={state.urgent} />
            <span style={{ marginLeft: 6 }}><label htmlFor="f-acil" style={{ display: 'inline', textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'inherit', fontSize: 14 }}>{t(locale, 'filters.urgentOnly')}</label></span>
          </span>
        </div>
      </fieldset>
      <div style={{ gridColumn: '1 / -1' }}><button className="btn" type="submit">{t(locale, 'filters.apply')}</button></div>
    </form>
  );
}
