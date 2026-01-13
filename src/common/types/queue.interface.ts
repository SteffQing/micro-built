export enum QueueName {
  repayments = 'repayments',
  reports = 'reports',
  services = 'services',
  maintenance = 'maintenance',
}

export enum RepaymentQueueName {
  process_new_repayments = 'process_new_repayments',
  process_liquidation_request = 'process_liquidation_request',
  process_overflow_repayments = 'process_overflow_repayments',
}

export enum ReportQueueName {
  schedule_variation = 'schedule_variation',
  customer_report = 'customer_report',
}

export enum ServicesQueueName {
  onboard_existing_customers = 'onboard_existing_customers',
}

export enum MaintenanceQueueName {
  supabase_ping = 'supabase_ping',
}

export interface AddExistingCustomers {
  file: Express.Multer.File;
}
