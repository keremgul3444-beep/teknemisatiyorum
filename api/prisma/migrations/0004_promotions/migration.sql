-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('vitrin', 'acil', 'bump');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('web', 'ios', 'android', 'manual');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded', 'cancelled');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "bumpedAt" TIMESTAMP(3),
ADD COLUMN     "featuredUntil" TIMESTAMP(3),
ADD COLUMN     "urgentUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Product" (
    "code" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL,
    "days" INTEGER,
    "priceWebKurus" INTEGER NOT NULL,
    "priceAppKurus" INTEGER NOT NULL,
    "iosProductId" TEXT,
    "androidProductId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isTrialPrice" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "amountKurus" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "providerRef" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_providerRef_key" ON "Order"("providerRef");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productCode_fkey" FOREIGN KEY ("productCode") REFERENCES "Product"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

