-- A one-off maintenance script (reset-september-2026, 6 Oct 2026) deleted payroll repayments without lowering the
-- loans' stored "repaid", so five loans kept repaid above their repayments. Repayments (and their breakdowns, which
-- the balances read) are the record: put "repaid" back to their sum wherever it drifted. invariants.sql now refuses
-- any commit that leaves a loan's totals and its rows apart.
UPDATE "Loan" l
SET "repaid" = p."paid"
FROM (
  SELECT l2."id", COALESCE(SUM(r."amount"), 0) AS "paid"
  FROM "Loan" l2 LEFT JOIN "Repayment" r ON r."loanId" = l2."id"
  GROUP BY l2."id"
) p
WHERE p."id" = l."id" AND l."repaid" <> p."paid";
