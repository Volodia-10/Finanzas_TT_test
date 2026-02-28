-- CreateTable
CREATE TABLE "AccountBalanceControl" (
    "id" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "openingBalance" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "actualBalance" DECIMAL(16,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountBalanceControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountBalanceControl_accountCode_key" ON "AccountBalanceControl"("accountCode");

-- CreateIndex
CREATE INDEX "AccountBalanceControl_accountCode_idx" ON "AccountBalanceControl"("accountCode");
