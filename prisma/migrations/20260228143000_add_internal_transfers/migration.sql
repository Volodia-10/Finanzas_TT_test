-- CreateTable
CREATE TABLE "InternalTransfer" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transferAt" TIMESTAMP(3) NOT NULL,
    "originAccountCode" TEXT NOT NULL,
    "destinationAccountCode" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "fee" DECIMAL(16,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "InternalTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalTransfer_transferAt_idx" ON "InternalTransfer"("transferAt");

-- CreateIndex
CREATE INDEX "InternalTransfer_originAccountCode_idx" ON "InternalTransfer"("originAccountCode");

-- CreateIndex
CREATE INDEX "InternalTransfer_destinationAccountCode_idx" ON "InternalTransfer"("destinationAccountCode");

-- AddForeignKey
ALTER TABLE "InternalTransfer" ADD CONSTRAINT "InternalTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
