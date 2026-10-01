// Star re-exports so each file's owner can add or drop classes without editing this barrel.
// Class names must stay unique across the folder (a duplicate breaks the build).
export * from './customer.entities';
export * from './customers.entities';
export * from './dashboard.entities';
export * from './loan.entities';
export * from './repayment.entity';
export * from './superadmin.entities';
