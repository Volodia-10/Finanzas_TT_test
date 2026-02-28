-- AlterTable
ALTER TABLE "Income" ADD COLUMN "requestId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "requestId" TEXT;
ALTER TABLE "InternalTransfer" ADD COLUMN "requestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Income_requestId_key" ON "Income"("requestId");
CREATE UNIQUE INDEX "Expense_requestId_key" ON "Expense"("requestId");
CREATE UNIQUE INDEX "InternalTransfer_requestId_key" ON "InternalTransfer"("requestId");
