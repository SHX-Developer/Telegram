-- AlterTable Chat: pinned message
ALTER TABLE "Chat" ADD COLUMN "pinnedMessageId" TEXT;

-- AlterTable ChatMember: pinned by user
ALTER TABLE "ChatMember"
  ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Message: forwarded from
ALTER TABLE "Message"
  ADD COLUMN "forwardedFromUserId" TEXT,
  ADD COLUMN "forwardedFromMessageId" TEXT;

-- FK для Chat.pinnedMessageId → Message (SET NULL on delete)
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_pinnedMessageId_fkey"
  FOREIGN KEY ("pinnedMessageId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FK для Message.forwardedFromUserId → User (SET NULL on delete)
ALTER TABLE "Message" ADD CONSTRAINT "Message_forwardedFromUserId_fkey"
  FOREIGN KEY ("forwardedFromUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FK для Message.forwardedFromMessageId → Message (SET NULL on delete)
ALTER TABLE "Message" ADD CONSTRAINT "Message_forwardedFromMessageId_fkey"
  FOREIGN KEY ("forwardedFromMessageId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
