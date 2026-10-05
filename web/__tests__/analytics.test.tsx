// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { Analytics, CONSENT_EVENT } from '../src/components/Analytics';

afterEach(() => { cleanup(); document.head.querySelectorAll('#umami').forEach((n) => n.remove()); document.cookie = 'tms_consent=; Max-Age=0; Path=/'; vi.restoreAllMocks(); });
const consent = (analytics: boolean) => { document.cookie = `tms_consent=${encodeURIComponent(JSON.stringify({ necessary: true, analytics, at: '2026-10-05T00:00:00Z' }))}; Path=/`; };
const ID = '6f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b';

test('izin yoksa ya da yalnızca zorunluysa ölçüm betiği yüklenmez', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ websiteId: ID })));
  consent(false);
  render(<Analytics />);
  await new Promise((r) => setTimeout(r, 20));
  expect(document.getElementById('umami')).toBeNull();
  expect(f).not.toHaveBeenCalled();
});

test('"Kabul et" sonrası betik sitenin kendi adresinden, site kimliğiyle yüklenir; ayar yoksa yüklenmez', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ websiteId: ID })));
  render(<Analytics />);
  consent(true);
  window.dispatchEvent(new Event(CONSENT_EVENT));
  await waitFor(() => expect(document.getElementById('umami')).not.toBeNull());
  const s = document.getElementById('umami') as HTMLScriptElement;
  expect(s.getAttribute('src')).toBe('/stats/script.js');
  expect(s.dataset.websiteId).toBe(ID);
  expect(s.dataset.hostUrl).toBe('/stats');
});
