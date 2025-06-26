-- DropEnum
DROP TYPE "RepaymentMethod";

-- CreateTable
CREATE TABLE "Config" (
    "key" TEXT NOT NULL,
    "value" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("key")
);
