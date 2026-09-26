-- Yabancı kimlik başvurusunun pasaport bilgileri
ALTER TABLE "VerificationRequest" ADD COLUMN "details" JSONB;
