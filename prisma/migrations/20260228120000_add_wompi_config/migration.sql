-- CreateTable
CREATE TABLE "WompiConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "baseFeeRate" DECIMAL(10,6) NOT NULL,
    "fixedFee" DECIMAL(16,2) NOT NULL,
    "ivaRate" DECIMAL(10,6) NOT NULL,
    "tcExtraRate" DECIMAL(10,6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WompiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WompiConfig_code_key" ON "WompiConfig"("code");
