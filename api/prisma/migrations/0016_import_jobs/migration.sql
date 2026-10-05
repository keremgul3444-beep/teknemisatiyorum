-- Firma toplu ilan yüklemesi
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "total" INTEGER NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB NOT NULL,
    "results" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportJob_companyId_createdAt_idx" ON "ImportJob"("companyId", "createdAt");
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");
