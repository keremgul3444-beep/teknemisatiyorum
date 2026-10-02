import { Injectable } from '@nestjs/common';
import { env } from '../config/env';

export const PUSH = Symbol('PUSH');

export interface PushMessage { to: string; title: string; body: string; data?: Record<string, unknown> }
export interface PushResult { invalidTokens: string[] }

/** Anlık bildirim takma yuvası: Expo Push (telefona) ya da bellek (test ve kapalı mod). */
export interface PushTransport {
  send(messages: PushMessage[]): Promise<PushResult>;
}

/** Expo Push servisi: Expo'nun ücretsiz aracı; cihaz kayıtsızsa (uygulama silinmiş) jeton geçersiz sayılır. */
@Injectable()
export class ExpoPushTransport implements PushTransport {
  private readonly endpoint = 'https://exp.host/--/api/v2/push/send';

  async send(messages: PushMessage[]): Promise<PushResult> {
    const invalidTokens: string[] = [];
    // Expo bir istekte en çok 100 bildirim kabul eder.
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100).map((m) => ({ ...m, sound: 'default', priority: 'high' }));
      try {
        const r = await fetch(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(chunk) });
        const j = (await r.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };
        j.data?.forEach((ticket, k) => {
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(chunk[k].to);
        });
      } catch (e) {
        // Ağ hatasında bildirim düşer; uygulama içi bildirim zaten kaydedildi.
        console.warn(`Anlık bildirim gönderilemedi: ${e instanceof Error ? e.message : e}`);
      }
    }
    return { invalidTokens };
  }
}

/** Bellekte tutan uygulama: testlerde ve PUSH_MODE=off iken (gönderilenler `sent`'te). */
@Injectable()
export class MemoryPushTransport implements PushTransport {
  readonly sent: PushMessage[] = [];
  async send(messages: PushMessage[]): Promise<PushResult> {
    this.sent.push(...messages);
    return { invalidTokens: messages.map((m) => m.to).filter((t) => t.includes('[bad')) };
  }
}

export const pushTransportClass = () => (env().PUSH_MODE === 'expo' ? ExpoPushTransport : MemoryPushTransport);

/** Expo jetonu biçimi: ExponentPushToken[...] ya da ExpoPushToken[...]. */
export const isExpoPushToken = (s: string) => /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{6,80}\]$/.test(s);
