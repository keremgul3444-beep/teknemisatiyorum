-- Emanet ödemede otomatik aktarım ve sorun bildirimi: usta işi bitirince süre başlar; itiraz aktarımı durdurur.
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "deliveredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServicePayment" ADD COLUMN     "autoReleaseAt" TIMESTAMP(3),
ADD COLUMN     "disputeNote" TEXT,
ADD COLUMN     "disputedAt" TIMESTAMP(3);

