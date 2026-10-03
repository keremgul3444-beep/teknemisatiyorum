-- 2. dalga: hizmet verenler, iş talepleri ve teklifler, kaptan rezervasyonları, emanet ödeme, değerlendirmeler.
-- CreateEnum
CREATE TYPE "ProviderKind" AS ENUM ('usta', 'kaptan');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('pending', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('open', 'accepted', 'paid', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('requested', 'paid', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "ServicePaymentStatus" AS ENUM ('pending', 'held', 'released', 'refunded', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubjectKind" ADD VALUE 'job';
ALTER TYPE "SubjectKind" ADD VALUE 'captain';
ALTER TYPE "SubjectKind" ADD VALUE 'provider';

-- CreateTable
CREATE TABLE "ProviderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ProviderKind" NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'pending',
    "displayName" TEXT NOT NULL,
    "categories" TEXT[],
    "region" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "priceNote" TEXT NOT NULL DEFAULT '',
    "yearsExp" INTEGER NOT NULL DEFAULT 0,
    "languages" TEXT[],
    "areas" TEXT[],
    "dayRateEur" INTEGER,
    "weekRateEur" INTEGER,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "boatId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "status" "JobStatus" NOT NULL DEFAULT 'open',
    "acceptedQuoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "priceTry" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptainBooking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "start" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "totalEur" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CaptainBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePayment" (
    "id" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "amountKurus" INTEGER NOT NULL,
    "feeKurus" INTEGER NOT NULL,
    "status" "ServicePaymentStatus" NOT NULL DEFAULT 'pending',
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "ServicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderProfile_kind_status_idx" ON "ProviderProfile"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_userId_kind_key" ON "ProviderProfile"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Job_acceptedQuoteId_key" ON "Job"("acceptedQuoteId");

-- CreateIndex
CREATE INDEX "Job_ownerId_createdAt_idx" ON "Job"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_status_category_idx" ON "Job"("status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_jobId_providerId_key" ON "Quote"("jobId", "providerId");

-- CreateIndex
CREATE INDEX "CaptainBooking_userId_createdAt_idx" ON "CaptainBooking"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CaptainBooking_providerId_start_idx" ON "CaptainBooking"("providerId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePayment_providerRef_key" ON "ServicePayment"("providerRef");

-- CreateIndex
CREATE INDEX "ServicePayment_subjectKind_subjectId_idx" ON "ServicePayment"("subjectKind", "subjectId");

-- CreateIndex
CREATE INDEX "ServicePayment_status_createdAt_idx" ON "ServicePayment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_providerId_createdAt_idx" ON "Review"("providerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_subjectKind_subjectId_key" ON "Review"("subjectKind", "subjectId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptainBooking" ADD CONSTRAINT "CaptainBooking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

