-- Fiyat geçmişi ("fiyat düştü" rozeti ve bildirimi) ve ilan görüntülenme sayacı (satıcı istatistikleri).
ALTER TABLE "Listing" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceHistory_listingId_at_idx" ON "PriceHistory"("listingId", "at");

ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
