-- AlterTable
ALTER TABLE "Message"
  ADD COLUMN "replyToId" TEXT,
  ADD COLUMN "deletedForUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
