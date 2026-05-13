-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "phoneNumber" TEXT,
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "birthday" TIMESTAMP(3);

-- Backfill firstName from existing displayName
UPDATE "User" SET "firstName" = "displayName" WHERE "firstName" IS NULL;

-- firstName становится обязательным
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;

-- username становится опциональным (поле UNIQUE остаётся, но допускает NULL)
ALTER TABLE "User" ALTER COLUMN "username" DROP NOT NULL;

-- Уникальный индекс на phoneNumber. NULL не считаются равными в Postgres,
-- поэтому несколько NULL допустимо.
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- Индекс для поиска по телефону
CREATE INDEX "User_phoneNumber_idx" ON "User"("phoneNumber");
