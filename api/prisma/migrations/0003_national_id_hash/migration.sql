ALTER TABLE "User" ADD COLUMN "nationalIdHash" TEXT;
CREATE UNIQUE INDEX "User_nationalIdHash_key" ON "User"("nationalIdHash");
ALTER TABLE "User" ADD COLUMN "prefs" JSONB;
