-- AlterTable
ALTER TABLE "AccountBalanceControl"
ADD COLUMN "openingBalanceSetAt" TIMESTAMP(3);

-- Backfill: if there was already a non-zero opening balance, mark it as configured
UPDATE "AccountBalanceControl"
SET "openingBalanceSetAt" = "updatedAt"
WHERE "openingBalanceSetAt" IS NULL
  AND "openingBalance" <> 0;
