import { Injectable } from '@nestjs/common';
import type { LogKind, LogbookEntry } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

/** Sistemin yazdığı kayıt başlıkları çeviri anahtarıdır ve bu önekle saklanır; istemci önekliyse çevirir. */
export const I18N_PREFIX = 'i18n:';

export const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
/** 'YYYY-MM-DD' → saat diliminden bağımsız takvim günü (UTC gece yarısı; veritabanında `date` tipi). */
export const parseDateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);

export function entryView(e: LogbookEntry) {
  return { id: e.id, kind: e.kind, date: dateOnly(e.date), title: e.title, byName: e.byName, verified: e.verified };
}

@Injectable()
export class LogbookService {
  constructor(private readonly prisma: PrismaService) {}

  /** Platform üzerinden gerçekleşen işlerin (ekspertiz, onarım) doğrulanmış karne kaydı. */
  addVerified(boatId: string, e: { kind: LogKind; date: string; title: string; byName: string; sourceRef?: string }) {
    return this.prisma.logbookEntry.create({ data: { boatId, kind: e.kind, date: parseDateOnly(e.date), title: e.title, byName: e.byName, verified: true, sourceRef: e.sourceRef } });
  }
}
