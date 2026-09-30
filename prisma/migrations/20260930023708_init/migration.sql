-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FLAGGED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Female', 'Male');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('Single', 'Married', 'Divorced', 'Widowed');

-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('Spouse', 'Parent', 'Child', 'Sibling', 'Other');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'MARKETER', 'SUPER_ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LoanCategory" AS ENUM ('EDUCATION', 'PERSONAL', 'BUSINESS', 'MEDICAL', 'RENT', 'TRAVEL', 'AGRICULTURE', 'UTILITIES', 'EMERGENCY', 'OTHERS', 'ASSET_PURCHASE');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'REJECTED', 'APPROVED', 'DISBURSED', 'REPAID');

-- CreateEnum
CREATE TYPE "MicroLoanPurpose" AS ENUM ('NEW_LOAN', 'TOPUP', 'INTEREST', 'PENALTY');

-- CreateEnum
CREATE TYPE "MicroLoanStatus" AS ENUM ('PENDING', 'REJECTED', 'DISBURSED');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('PENDING', 'REJECTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "DeductionStatus" AS ENUM ('OPEN', 'AWAITING', 'FULFILLED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "Month" AS ENUM ('JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER');

-- CreateEnum
CREATE TYPE "RepaymentComponent" AS ENUM ('PRINCIPAL', 'PENALTY', 'INTEREST');

-- CreateEnum
CREATE TYPE "PaymentInflowSource" AS ENUM ('PAYROLL', 'LIQUIDATION');

-- CreateEnum
CREATE TYPE "PaymentInflowState" AS ENUM ('UNMATCHED', 'AWAITING', 'REVIEWING', 'SETTLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOAN_APPROVED', 'LOAN_REJECTED', 'LOAN_DISBURSED', 'TOPUP_APPROVED', 'TOPUP_REJECTED', 'TOPUP_DISBURSED', 'PENALTY_APPLIED', 'EXTENSION_APPROVED', 'EXTENSION_REJECTED', 'PAYMENT_INFLOW_APPROVED', 'PAYMENT_INFLOW_REJECTED', 'VARIATION_SUBMITTED', 'PERIOD_CLOSED');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('LOAN', 'MICRO_LOAN', 'TENURE_EXTENSION', 'PAYMENT_INFLOW', 'PAYROLL_PERIOD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "type" "UserType" NOT NULL,
    "email" TEXT,
    "contact" TEXT,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'INACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "userId" TEXT NOT NULL,
    "externalId" TEXT,
    "flagReason" TEXT,
    "accountOfficerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CustomerIdentity" (
    "userId" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
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

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CustomerPaymentMethod" (
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bvn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPaymentMethod_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CustomerPayroll" (
    "externalId" TEXT NOT NULL,
    "netPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employeeGross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grade" TEXT,
    "step" INTEGER,
    "command" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPayroll_pkey" PRIMARY KEY ("externalId")
);

-- CreateTable
CREATE TABLE "Admin" (
    "userId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "interestRate" DECIMAL(5,4) NOT NULL,
    "managementFeeRate" DECIMAL(5,4) NOT NULL,
    "tenure" INTEGER NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "owed" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "repaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "disbursementDate" TIMESTAMP(3),
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicroLoan" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "purpose" "MicroLoanPurpose" NOT NULL,
    "status" "MicroLoanStatus" NOT NULL DEFAULT 'DISBURSED',
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MicroLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommodityLoan" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "publicDetails" TEXT,
    "privateDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommodityLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commodity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commodity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenureExtension" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "previousTenure" INTEGER NOT NULL,
    "addedMonths" INTEGER NOT NULL,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenureExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "paymentInflowId" TEXT NOT NULL,
    "deductionId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deduction" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "expected" DECIMAL(18,2) NOT NULL,
    "status" "DeductionStatus" NOT NULL DEFAULT 'OPEN',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "month" "Month" NOT NULL,
    "year" INTEGER NOT NULL,
    "variationSubmittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepaymentBreakdown" (
    "id" TEXT NOT NULL,
    "repaymentId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "component" "RepaymentComponent" NOT NULL,

    CONSTRAINT "RepaymentBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollUpload" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInflow" (
    "id" TEXT NOT NULL,
    "source" "PaymentInflowSource" NOT NULL,
    "periodId" TEXT NOT NULL,
    "uploadId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "customerId" TEXT,
    "externalUserId" TEXT,
    "state" "PaymentInflowState" NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentInflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "interestRate" DECIMAL(5,4) NOT NULL,
    "managementFeeRate" DECIMAL(5,4) NOT NULL,
    "penaltyRate" DECIMAL(5,4) NOT NULL,
    "inMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "callToActionUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_contact_key" ON "User"("contact");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalId_key" ON "Customer"("externalId");

-- CreateIndex
CREATE INDEX "Customer_accountOfficerId_idx" ON "Customer"("accountOfficerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPaymentMethod_accountNumber_key" ON "CustomerPaymentMethod"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPaymentMethod_bvn_key" ON "CustomerPaymentMethod"("bvn");

-- CreateIndex
CREATE INDEX "Loan_borrowerId_idx" ON "Loan"("borrowerId");

-- CreateIndex
CREATE INDEX "MicroLoan_loanId_idx" ON "MicroLoan"("loanId");

-- CreateIndex
CREATE INDEX "CommodityLoan_loanId_idx" ON "CommodityLoan"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "Commodity_name_key" ON "Commodity"("name");

-- CreateIndex
CREATE INDEX "TenureExtension_loanId_idx" ON "TenureExtension"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "Repayment_paymentInflowId_key" ON "Repayment"("paymentInflowId");

-- CreateIndex
CREATE INDEX "Repayment_loanId_idx" ON "Repayment"("loanId");

-- CreateIndex
CREATE INDEX "Repayment_deductionId_idx" ON "Repayment"("deductionId");

-- CreateIndex
CREATE INDEX "Deduction_periodId_status_idx" ON "Deduction"("periodId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Deduction_loanId_periodId_key" ON "Deduction"("loanId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_year_month_key" ON "PayrollPeriod"("year", "month");

-- CreateIndex
CREATE INDEX "RepaymentBreakdown_repaymentId_idx" ON "RepaymentBreakdown"("repaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollUpload_fileHash_key" ON "PayrollUpload"("fileHash");

-- CreateIndex
CREATE INDEX "PaymentInflow_customerId_idx" ON "PaymentInflow"("customerId");

-- CreateIndex
CREATE INDEX "PaymentInflow_periodId_idx" ON "PaymentInflow"("periodId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_accountOfficerId_fkey" FOREIGN KEY ("accountOfficerId") REFERENCES "Admin"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Customer"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPaymentMethod" ADD CONSTRAINT "CustomerPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Customer"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayroll" ADD CONSTRAINT "CustomerPayroll_externalId_fkey" FOREIGN KEY ("externalId") REFERENCES "Customer"("externalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "Customer"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Admin"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicroLoan" ADD CONSTRAINT "MicroLoan_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityLoan" ADD CONSTRAINT "CommodityLoan_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityLoan" ADD CONSTRAINT "CommodityLoan_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenureExtension" ADD CONSTRAINT "TenureExtension_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenureExtension" ADD CONSTRAINT "TenureExtension_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Admin"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_paymentInflowId_fkey" FOREIGN KEY ("paymentInflowId") REFERENCES "PaymentInflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_deductionId_fkey" FOREIGN KEY ("deductionId") REFERENCES "Deduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepaymentBreakdown" ADD CONSTRAINT "RepaymentBreakdown_repaymentId_fkey" FOREIGN KEY ("repaymentId") REFERENCES "Repayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollUpload" ADD CONSTRAINT "PayrollUpload_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollUpload" ADD CONSTRAINT "PayrollUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Admin"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInflow" ADD CONSTRAINT "PaymentInflow_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInflow" ADD CONSTRAINT "PaymentInflow_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "PayrollUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInflow" ADD CONSTRAINT "PaymentInflow_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Admin"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
