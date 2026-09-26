import type { ListingDraft } from '@/services/types';

export interface PublishExtra { photoUris?: string[]; broker?: boolean; ownershipUri?: string }
interface Deps {
  post: (path: string, body?: unknown) => Promise<unknown>;
  patch: (path: string, body?: unknown) => Promise<unknown>;
  upload: (uri: string, visibility: 'public' | 'private') => Promise<string>;
}

/**
 * İlan gönderimi birkaç adımdır (taslak → fotoğraflar → onaya gönder → ruhsat → broker). Bir adım hata
 * verirse (ör. seviye yetersiz) yeniden denemede tamamlanan adımlar tekrarlanmaz: aynı taslak güncellenir,
 * yüklenmiş fotoğraflar yeniden yüklenmez. Başarıdan sonra durum sıfırlanır.
 */
export function createPublisher(deps: Deps) {
  let st: { listingId?: string; files: Map<string, string>; submitted?: boolean; ownership?: boolean; broker?: boolean } = { files: new Map() };

  return async function publish(d: ListingDraft, extra: PublishExtra): Promise<string> {
    let id = st.listingId;
    if (!id) id = st.listingId = ((await deps.post('/listings', d)) as { id: string }).id;
    else await deps.patch(`/listings/${id}`, d);

    for (const uri of extra.photoUris ?? []) if (!st.files.has(uri)) st.files.set(uri, await deps.upload(uri, 'public'));
    const fileIds = (extra.photoUris ?? []).map((u) => st.files.get(u)!);
    if (fileIds.length) await deps.post(`/listings/${id}/photos`, { fileIds });

    if (!st.submitted) { await deps.post(`/listings/${id}/submit`); st.submitted = true; }
    if (extra.ownershipUri && !st.ownership) {
      await deps.post('/verification/requests', { kind: 'ruhsat', fileIds: [await deps.upload(extra.ownershipUri, 'private')], listingId: id });
      st.ownership = true;
    }
    if (extra.broker && !st.broker) {
      await deps.post('/broker/cases', { boatName: `${d.brand} ${d.model}`, askingPrice: d.price, currency: d.currency });
      st.broker = true;
    }
    st = { files: new Map() };
    return id;
  };
}
