import type { ListingDraft } from '@/services/types';

export interface PublishExtra {
  photoUris?: string[]; broker?: boolean;
  /** Ruhsat/bağlama kütüğü fotoğrafı; yanında motor seri numarası fotoğrafı ve son haneleri verilirse "belgeleri eşleşti" için birlikte gönderilir. */
  ownershipUri?: string; engineDocUri?: string; engineSerialLast4?: string;
  /** Fotoğraf yükleme ilerlemesi (20 fotoğrafa kadar sürebilir): yüklenen / toplam. */
  onProgress?: (done: number, total: number) => void;
  /** Sunucuda taslak açılınca kimliği bildirilir; uygulama kapanıp açılırsa aynı taslaktan sürdürülür (ikinci ilan açılmaz). */
  onDraftCreated?: (listingId: string) => void;
}
interface Deps {
  post: (path: string, body?: unknown) => Promise<unknown>;
  patch: (path: string, body?: unknown) => Promise<unknown>;
  put: (path: string, body?: unknown) => Promise<unknown>;
  upload: (uri: string, visibility: 'public' | 'private') => Promise<string>;
}

/**
 * İlan gönderimi birkaç adımdır (taslak → fotoğraflar → onaya gönder → ruhsat → broker). Bir adım hata
 * verirse (ör. seviye yetersiz) yeniden denemede tamamlanan adımlar tekrarlanmaz: aynı taslak güncellenir,
 * yüklenmiş fotoğraflar yeniden yüklenmez. Başarıdan sonra durum sıfırlanır.
 */
export function createPublisher(deps: Deps) {
  type State = { listingId?: string; files: Map<string, string>; submitted?: boolean; ownership?: boolean; broker?: boolean };
  let st: State = { files: new Map() };
  const create = async (d: ListingDraft) => ((await deps.post('/listings', d)) as { id: string }).id;

  async function publish(d: ListingDraft, extra: PublishExtra): Promise<string> {
    let id = st.listingId;
    if (id) {
      try {
        await deps.patch(`/listings/${id}`, d);
      } catch (e) {
        // Yarım taslak silinmiş ya da kapanmışsa (404/409) baştan, yeni taslakla başlanır.
        const status = (e as { status?: number }).status;
        if (status !== 404 && status !== 409) throw e;
        st = { files: new Map() };
        id = undefined;
      }
    }
    if (!id) {
      id = st.listingId = await create(d);
      extra.onDraftCreated?.(id);
    }

    const uris = extra.photoUris ?? [];
    let done = uris.filter((u) => st.files.has(u)).length;
    if (uris.length) extra.onProgress?.(done, uris.length);
    for (const uri of uris) {
      if (st.files.has(uri)) continue;
      st.files.set(uri, await deps.upload(uri, 'public'));
      extra.onProgress?.(++done, uris.length);
    }
    // Tam liste ve sıra gönderilir: yeniden denemede sonradan silinen fotoğraf ilanda kalmaz, kapak değişikliği işler.
    const fileIds = uris.map((u) => st.files.get(u)!);
    if (fileIds.length) await deps.put(`/listings/${id}/photos`, { fileIds });

    if (!st.submitted) {
      try {
        await deps.post(`/listings/${id}/submit`);
      } catch (e) {
        // Sürdürülen taslak daha önce onaya gönderilmişse (409) yeniden göndermeye gerek yok.
        if ((e as { status?: number }).status !== 409) throw e;
      }
      st.submitted = true;
    }
    if (extra.ownershipUri && !st.ownership) {
      const fileIds = [await deps.upload(extra.ownershipUri, 'private')];
      if (extra.engineDocUri) fileIds.push(await deps.upload(extra.engineDocUri, 'private'));
      const details = extra.engineSerialLast4 ? { engineSerialLast4: extra.engineSerialLast4 } : undefined;
      try {
        await deps.post('/verification/requests', { kind: 'ruhsat', fileIds, listingId: id, ...(details ? { details } : {}) });
      } catch (e) {
        // Önceki denemede başvuru ulaşmışsa (bekleyen başvuru var, 409) yeniden açılmaz.
        if ((e as { status?: number }).status !== 409) throw e;
      }
      st.ownership = true;
    }
    if (extra.broker && !st.broker) {
      await deps.post('/broker/cases', { boatName: `${d.brand} ${d.model}`, askingPrice: d.price, currency: d.currency });
      st.broker = true;
    }
    st = { files: new Map() };
    return id;
  }
  /** Çıkış/giriş yapılınca yarım kalan gönderim unutulur (başka hesap aynı taslağa dokunmasın). */
  publish.reset = () => { st = { files: new Map() }; };
  /** Uygulama yeniden açıldıysa sunucudaki yarım taslaktan devam edilir (taslak kimliği yerel kayıttan gelir). */
  publish.resume = (listingId: string) => { if (!st.listingId) st = { files: new Map(), listingId }; };
  return publish;
}
