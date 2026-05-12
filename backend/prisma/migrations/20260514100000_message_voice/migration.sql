-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('text', 'voice');

-- AlterTable
ALTER TABLE "Message"
  ADD COLUMN "kind" "MessageKind" NOT NULL DEFAULT 'text',
  ADD COLUMN "attachmentUrl" TEXT,
  ADD COLUMN "attachmentDurationSec" INTEGER;
