-- Fix typo in LiquidationStatus enum: REVEIWING -> REVIEWING
-- RENAME VALUE preserves existing rows (Postgres 10+).
ALTER TYPE "LiquidationStatus" RENAME VALUE 'REVEIWING' TO 'REVIEWING';
