// Star re-exports so each file's owner can add or drop classes without editing this barrel.
// Class names must stay unique across the folder (a duplicate breaks the build).
export * from './customer.dto';
export * from './export.dto';
export * from './loan.dto';
export * from './payroll-variation.dto';
export * from './repayment.dto';
export * from './superadmin.dto';
export * from '../entities/dashboard.entities';
