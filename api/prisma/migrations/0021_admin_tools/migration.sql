-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "approvedSnapshot" JSONB;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "hiddenAt" TIMESTAMP(3);
