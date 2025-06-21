-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CUSTOMER', 'VENDOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FLAGGED');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('CASH', 'ASSET');

-- CreateEnum
CREATE TYPE "LoanCategory" AS ENUM ('EDUCATION', 'PERSONAL', 'BUSINESS', 'MEDICAL', 'RENT', 'TRAVEL', 'AGRICULTURE', 'UTILITIES', 'EMERGENCY', 'ASSET_PURCHASE', 'OTHERS');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'DISBURSED', 'REJECTED', 'REPAID', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "RepaymentMethod" AS ENUM ('CARD', 'TRANSFER', 'USSD', 'WALLET');

-- CreateEnum
CREATE TYPE "RepaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "documents" TEXT[],
    "residencyAddress" TEXT NOT NULL,
    "stateResidency" TEXT NOT NULL,
    "nextOfKinName" TEXT NOT NULL,
    "nextOfKinContact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "userId" TEXT NOT NULL,
    "creditScore" INTEGER NOT NULL DEFAULT 0,
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "interestRate" DECIMAL(5,4) NOT NULL,
    "lateFeeRate" DECIMAL(5,4) NOT NULL,
    "revenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "loanType" "LoanType" NOT NULL DEFAULT 'CASH',
    "category" "LoanCategory" NOT NULL,
    "disbursementDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assetId" TEXT,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "RepaymentMethod" NOT NULL,
    "status" "RepaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "reference" TEXT,
    "loanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "inStock" INTEGER NOT NULL DEFAULT 0,
    "threshold" INTEGER NOT NULL DEFAULT 10,
    "vendorId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_contact_key" ON "User"("contact");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_userId_key" ON "UserIdentity"("userId");

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
