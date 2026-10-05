-- İlan videosu bağlantısı ve teklif talepleri
ALTER TABLE "Listing" ADD COLUMN "videoUrl" TEXT;

CREATE TABLE "LeadRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "LeadRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadRequest_status_createdAt_idx" ON "LeadRequest"("status", "createdAt");
CREATE INDEX "LeadRequest_userId_createdAt_idx" ON "LeadRequest"("userId", "createdAt");
