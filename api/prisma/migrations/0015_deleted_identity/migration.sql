-- Silinip yeniden açılan hesap tanıma
ALTER TABLE "User" ADD COLUMN "reregisteredFrom" TEXT;

CREATE TABLE "DeletedIdentity" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "deletedUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedIdentity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeletedIdentity_hash_idx" ON "DeletedIdentity"("hash");
CREATE INDEX "DeletedIdentity_createdAt_idx" ON "DeletedIdentity"("createdAt");
