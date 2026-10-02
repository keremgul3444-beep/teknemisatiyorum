-- Mesajlaşma korumaları: sohbeti açan kişi, engelleme ve gönderici bazlı sınır için dizin.
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "startedById" TEXT;

-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN     "blockedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Conversation_startedById_createdAt_idx" ON "Conversation"("startedById", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");
