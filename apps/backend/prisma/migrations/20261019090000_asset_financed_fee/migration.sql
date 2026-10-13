-- An asset loan's management fee is added to what is owed, not kept from cash.
ALTER TABLE "MicroLoan" ADD COLUMN "financedFee" DECIMAL(18,2);
