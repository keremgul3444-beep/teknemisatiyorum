-- İlan yayın süresi: süresi dolan ilan 'expired' olur, sahibi yeniler.
-- AlterEnum
ALTER TYPE "ListingStatus" ADD VALUE 'expired';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "expiryWarnedAt" TIMESTAMP(3);


-- Yayındaki ilanlara bugünden başlayan 90 günlük süre (hemen düşmesinler).
UPDATE "Listing" SET "expiresAt" = NOW() + INTERVAL '90 days' WHERE "status" = 'published';
