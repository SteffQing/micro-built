export enum QueueName {
  repayments = 'repayments',
  reports = 'reports',
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
