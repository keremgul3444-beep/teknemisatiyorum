/**
 * Uygulama bağlantısı doğrulama dosyaları: iOS (apple-app-site-association) ve Android (assetlinks.json).
 * Ekip kimliği ve imza parmak izi mağaza hesapları açılınca ortam değişkeniyle verilir; yoksa dosya sunulmaz (404).
 */
export const APP_ID = process.env.APP_BUNDLE_ID ?? 'com.teknemisatiyorum.app';
const PATHS = ['/ilan/*', '/en/ilan/*'];

export function appleAssociation(teamId = process.env.APPLE_TEAM_ID ?? '') {
  if (!/^[A-Z0-9]{10}$/.test(teamId)) return null;
  return { applinks: { details: [{ appIDs: [`${teamId}.${APP_ID}`], components: PATHS.map((p) => ({ '/': p })) }] } };
}

export function androidAssetLinks(fingerprints = process.env.ANDROID_CERT_SHA256 ?? '') {
  const prints = fingerprints.split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  if (!prints.length) return null;
  return [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: APP_ID, sha256_cert_fingerprints: prints } }];
}
