-- CreateEnum
CREATE TYPE "LiquidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MARKETER', 'CUSTOMER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FLAGGED');

-- CreateEnum
CREATE TYPE "LoanCategory" AS ENUM ('EDUCATION', 'PERSONAL', 'BUSINESS', 'MEDICAL', 'RENT', 'TRAVEL', 'AGRICULTURE', 'UTILITIES', 'EMERGENCY', 'OTHERS', 'ASSET_PURCHASE');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('New', 'Topup');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'REJECTED', 'APPROVED', 'DISBURSED', 'REPAID');

-- CreateEnum
CREATE TYPE "RepaymentStatus" AS ENUM ('AWAITING', 'PARTIAL', 'FULFILLED', 'FAILED', 'MANUAL_RESOLUTION');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Female', 'Male');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('Single', 'Married', 'Divorced', 'Widowed');

-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('Spouse', 'Parent', 'Child', 'Sibling', 'Other');

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
    "email" TEXT,
    "contact" TEXT,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INACTIVE',
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "repaymentRate" INTEGER NOT NULL DEFAULT 100,
    "accountOfficerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPayroll" (
    "userId" TEXT NOT NULL,
    "netPay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "employeeGross" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grade" TEXT,
    "step" INTEGER,
    "command" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPayroll_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "userId" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "maritalStatus" "MaritalStatus" NOT NULL,
    "residencyAddress" TEXT NOT NULL,
    "stateResidency" TEXT NOT NULL,
    "landmarkOrBusStop" TEXT NOT NULL,
    "nextOfKinName" TEXT NOT NULL,
    "nextOfKinContact" TEXT NOT NULL,
    "nextOfKinAddress" TEXT NOT NULL,
    "nextOfKinRelationship" "Relationship" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserPaymentMethod" (
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bvn" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPaymentMethod_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "principal" DECIMAL(10,2) NOT NULL,
    "penalty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "repaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "managementFeeRate" DECIMAL(5,4) NOT NULL,
    "interestRate" DECIMAL(5,4) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "category" "LoanCategory" NOT NULL,
    "tenure" INTEGER NOT NULL DEFAULT 0,
    "extension" INTEGER NOT NULL DEFAULT 0,
    "disbursementDate" TIMESTAMP(3),
    "borrowerId" TEXT NOT NULL,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "LoanType" NOT NULL DEFAULT 'New',

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expectedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "repaidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "penaltyCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL,
    "periodInDT" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "RepaymentStatus" NOT NULL DEFAULT 'AWAITING',
    "failureNote" TEXT,
    "resolutionNote" TEXT,
    "userId" TEXT,
    "loanId" TEXT,
    "liquidationRequestId" TEXT,

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
    "borrowerId" TEXT NOT NULL,
    "requestedById" TEXT,

    CONSTRAINT "CommodityLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "callToActionUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidationRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "LiquidationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "adminId" TEXT NOT NULL,

    CONSTRAINT "LiquidationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_contact_key" ON "User"("contact");

-- CreateIndex
CREATE INDEX "User_accountOfficerId_idx" ON "User"("accountOfficerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPaymentMethod_accountNumber_key" ON "UserPaymentMethod"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UserPaymentMethod_bvn_key" ON "UserPaymentMethod"("bvn");

-- CreateIndex
CREATE INDEX "Repayment_userId_loanId_period_idx" ON "Repayment"("userId", "loanId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "CommodityLoan_loanId_key" ON "CommodityLoan"("loanId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountOfficerId_fkey" FOREIGN KEY ("accountOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPayroll" ADD CONSTRAINT "UserPayroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("externalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPaymentMethod" ADD CONSTRAINT "UserPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_liquidationRequestId_fkey" FOREIGN KEY ("liquidationRequestId") REFERENCES "LiquidationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityLoan" ADD CONSTRAINT "CommodityLoan_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityLoan" ADD CONSTRAINT "CommodityLoan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityLoan" ADD CONSTRAINT "CommodityLoan_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidationRequest" ADD CONSTRAINT "LiquidationRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
