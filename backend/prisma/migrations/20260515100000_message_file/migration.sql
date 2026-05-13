-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE 'file';

-- AlterTable
ALTER TABLE "Message"
  ADD COLUMN "attachmentName" TEXT,
  ADD COLUMN "attachmentMime" TEXT,
  ADD COLUMN "attachmentSize" INTEGER;
