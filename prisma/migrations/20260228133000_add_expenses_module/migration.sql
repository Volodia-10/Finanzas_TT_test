-- CreateTable
CREATE TABLE "ExpenseMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseMonth" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEmployee" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseAuthorizer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseAuthorizer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseResponsible" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseResponsible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarName" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarMotive" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarMotive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "realAmount" DECIMAL(16,2) NOT NULL,
    "accountCode" TEXT NOT NULL,
    "methodCode" TEXT NOT NULL,
    "semesterCode" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonBase" TEXT,
    "monthCode" TEXT,
    "carNameCode" TEXT,
    "carMotiveCode" TEXT,
    "carReasonText" TEXT,
    "authorizedBy" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseMethod_code_key" ON "ExpenseMethod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseMonth_code_key" ON "ExpenseMonth"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEmployee_code_key" ON "ExpenseEmployee"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseAuthorizer_code_key" ON "ExpenseAuthorizer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseResponsible_code_key" ON "ExpenseResponsible"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CarName_code_key" ON "CarName"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CarMotive_code_key" ON "CarMotive"("code");

-- CreateIndex
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");

-- CreateIndex
CREATE INDEX "Expense_accountCode_idx" ON "Expense"("accountCode");

-- CreateIndex
CREATE INDEX "Expense_methodCode_idx" ON "Expense"("methodCode");

-- CreateIndex
CREATE INDEX "Expense_semesterCode_idx" ON "Expense"("semesterCode");

-- CreateIndex
CREATE INDEX "Expense_categoryCode_idx" ON "Expense"("categoryCode");

-- CreateIndex
CREATE INDEX "Expense_authorizedBy_idx" ON "Expense"("authorizedBy");

-- CreateIndex
CREATE INDEX "Expense_responsible_idx" ON "Expense"("responsible");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
