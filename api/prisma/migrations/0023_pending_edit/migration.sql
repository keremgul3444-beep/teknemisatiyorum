-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "pendingAt" TIMESTAMP(3),
ADD COLUMN     "pendingChanges" JSONB,
ADD COLUMN     "pendingPhotoIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Listing_pendingAt_idx" ON "Listing"("pendingAt");
