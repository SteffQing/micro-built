-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CUSTOMER', 'SUPER_ADMIN', 'VIEW_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FLAGGED');

-- CreateEnum
CREATE TYPE "LoanCategory" AS ENUM ('EDUCATION', 'PERSONAL', 'BUSINESS', 'MEDICAL', 'RENT', 'TRAVEL', 'AGRICULTURE', 'UTILITIES', 'EMERGENCY', 'OTHERS', 'ASSET_PURCHASE');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'PREVIEW', 'REJECTED', 'ACCEPTED', 'APPROVED', 'DISBURSED', 'REPAID');

-- CreateEnum
CREATE TYPE "RepaymentStatus" AS ENUM ('AWAITING', 'PARTIAL', 'FULFILLED', 'OVERPAID', 'FAILED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Female', 'Male');

-- CreateTable
CREATE TABLE "Config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "avatar" TEXT,
    "externalId" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INACTIVE',
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPayroll" (
    "userId" TEXT NOT NULL,
    "netPay" DECIMAL(10,2) NOT NULL,
    "grade" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "command" TEXT NOT NULL,

    CONSTRAINT "UserPayroll_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "userId" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "documents" TEXT[],
    "gender" "Gender" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "residencyAddress" TEXT NOT NULL,
    "stateResidency" TEXT NOT NULL,
    "nextOfKinName" TEXT NOT NULL,
    "nextOfKinContact" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserPaymentMethod" (
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPaymentMethod_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "amountRepayable" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amountRepaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "managementFee" DECIMAL(5,4) NOT NULL,
    "interestRate" DECIMAL(5,4) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "category" "LoanCategory" NOT NULL,
    "disbursementDate" TIMESTAMP(3),
    "loanTenure" INTEGER NOT NULL DEFAULT 0,
    "extension" INTEGER NOT NULL DEFAULT 0,
    "borrowerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expectedAmount" DECIMAL(10,2) NOT NULL,
    "repaidAmount" DECIMAL(10,2) NOT NULL,
    "period" TEXT NOT NULL,
    "periodInDT" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RepaymentStatus" NOT NULL DEFAULT 'AWAITING',
    "userId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,

    CONSTRAINT "Repayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommodityLoan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inReview" BOOLEAN NOT NULL DEFAULT true,
    "publicDetails" TEXT,
    "privateDetails" TEXT,
    "loanId" TEXT,
    "userId" TEXT,

    CONSTRAINT "CommodityLoan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_contact_key" ON "UserIdentity"("contact");

-- CreateIndex
CREATE UNIQUE INDEX "CommodityLoan_loanId_key" ON "CommodityLoan"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "CommodityLoan_userId_key" ON "CommodityLoan"("userId");

-- AddForeignKey
ALTER TABLE "UserPayroll" ADD CONSTRAINT "UserPayroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("externalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPaymentMethod" ADD CONSTRAINT "UserPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("externalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityLoan" ADD CONSTRAINT "CommodityLoan_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityLoan" ADD CONSTRAINT "CommodityLoan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
