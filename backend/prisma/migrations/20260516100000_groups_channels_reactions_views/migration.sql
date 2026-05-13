-- AlterEnum
ALTER TYPE "ChatType" ADD VALUE 'group';
ALTER TYPE "ChatType" ADD VALUE 'channel';

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('owner', 'admin', 'member', 'subscriber');

-- AlterTable Chat
ALTER TABLE "Chat"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "avatarUrl" TEXT;

-- AlterTable ChatMember
ALTER TABLE "ChatMember"
  ADD COLUMN "role" "ChatRole" NOT NULL DEFAULT 'member';

-- CreateTable MessageReaction
CREATE TABLE "MessageReaction" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_key" ON "MessageReaction"("messageId", "userId");
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");
ALTER TABLE "MessageReaction"
  ADD CONSTRAINT "MessageReaction_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable MessageView
CREATE TABLE "MessageView" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MessageView_messageId_userId_key" ON "MessageView"("messageId", "userId");
CREATE INDEX "MessageView_messageId_idx" ON "MessageView"("messageId");
ALTER TABLE "MessageView"
  ADD CONSTRAINT "MessageView_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
