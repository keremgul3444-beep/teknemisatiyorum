import type { NextFunction, Request, Response } from 'express';

/** "1.2.10" ≥ "1.2.9"; eksik parçalar 0 sayılır, sayı olmayan sürüm en eski kabul edilir. */
export function versionAtLeast(v: string, min: string): boolean {
  const parse = (s: string) => (/^\d+(\.\d+){0,2}$/.test(s) ? s.split('.').map(Number) : null);
  const a = parse(v.trim());
  const b = parse(min.trim());
  if (!b) return true;
  if (!a) return false;
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

/**
 * Zorunlu güncelleme: uygulama sürümünü `X-App-Version` başlığıyla bildirir; `MIN_APP_VERSION` altındaysa her istek
 * 426 döner ve uygulama "Güncelle" ekranını açar. Başlıksız istekler (site, eski sürüm olmayan istemciler) etkilenmez.
 */
export function appVersionGate(cfg: () => { min: string; ios: string; android: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const v = req.header('x-app-version');
    const c = cfg();
    if (!v || !c.min || req.path.startsWith('/health') || versionAtLeast(v, c.min)) return next();
    res.status(426).json({ code: 'UPGRADE_REQUIRED', messageKey: 'errors.upgrade_required', params: { min: c.min, ios: c.ios, android: c.android } });
  };
}
