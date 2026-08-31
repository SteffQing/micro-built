-- The interestPaid column was originally added with a zero default and no data
-- migration. Legacy repayment rows therefore under-report Interest Received.
--
-- Legacy payments used proportional principal/interest allocation after the
-- period's penalty portion. Canonical obligation-ledger payments have no loanId
-- on their compatibility Repayment row, so this only repairs legacy records.
UPDATE "Repayment" AS r
SET "interestPaid" = ROUND(
  GREATEST(0, r."repaidAmount" - r."penaltyCharge")
    * (l."repayable" - l."principal") / l."repayable",
  2
)
FROM "Loan" AS l
WHERE r."loanId" = l.id
  AND r."receiptId" IS NULL
  AND r.status IN ('FULFILLED', 'PARTIAL')
  AND r."repaidAmount" > 0
  AND r."interestPaid" = 0
  AND l."repayable" > l."principal"
  AND l."repayable" > 0;
