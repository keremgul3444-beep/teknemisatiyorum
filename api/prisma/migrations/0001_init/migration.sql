-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'moderator', 'admin');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'pending', 'published', 'rejected', 'sold', 'removed');

-- CreateEnum
CREATE TYPE "VerificationKind" AS ENUM ('identity', 'usta', 'kaptan', 'eksper', 'firma', 'ruhsat');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "LogKind" AS ENUM ('bakim', 'onarim', 'ekspertiz', 'sahiplik');

-- CreateEnum
CREATE TYPE "SubjectKind" AS ENUM ('listing', 'broker', 'expertise');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('TRY', 'EUR', 'USD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "email" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'tr',
    "verifyLevel" INTEGER NOT NULL DEFAULT 0,
    "roles" "Role"[] DEFAULT ARRAY['user']::"Role"[],
    "nationalIdEnc" TEXT,
    "nationalIdLast2" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("companyId","userId")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "VerificationKind" NOT NULL,
    "fileIds" TEXT[],
    "listingId" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "companyId" TEXT,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lengthM" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL,
    "location" TEXT NOT NULL,
    "equipment" TEXT[],
    "cabins" INTEGER NOT NULL DEFAULT 0,
    "engine" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "badges" TEXT[],
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingPhoto" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ListingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","listingId")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "filter" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boat" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lengthM" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogbookEntry" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "kind" "LogKind" NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogbookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "subjectKind" "SubjectKind" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectTitle" TEXT NOT NULL,
    "memberKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "phoneShared" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertisePackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceTry" INTEGER NOT NULL,
    "items" TEXT[],
    "order" INTEGER NOT NULL,

    CONSTRAINT "ExpertisePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertiseBooking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "listingId" TEXT,
    "date" DATE NOT NULL,
    "slot" TEXT NOT NULL,
    "reportStatus" TEXT NOT NULL DEFAULT 'pending',
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpertiseBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boatName" TEXT NOT NULL,
    "askingPrice" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "assigneeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "currency" "Currency" NOT NULL,
    "rateToTry" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("currency")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "params" JSONB,
    "targetType" TEXT,
    "targetId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "params" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "OtpCode_phone_createdAt_idx" ON "OtpCode"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyMember_userId_idx" ON "CompanyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "File_key_key" ON "File"("key");

-- CreateIndex
CREATE INDEX "VerificationRequest_status_kind_idx" ON "VerificationRequest"("status", "kind");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_ownerId_idx" ON "Listing"("ownerId");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_subjectKind_subjectId_memberKey_key" ON "Conversation"("subjectKind", "subjectId", "memberKey");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPhoto" ADD CONSTRAINT "ListingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boat" ADD CONSTRAINT "Boat_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookEntry" ADD CONSTRAINT "LogbookEntry_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

