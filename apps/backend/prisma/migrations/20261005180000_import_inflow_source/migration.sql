-- A running loan's "amount paid" from the existing-customer import is its own inflow source, not a payroll deduction.
ALTER TYPE "PaymentInflowSource" ADD VALUE IF NOT EXISTS 'IMPORT';
