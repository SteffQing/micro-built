export enum QueueName {
  repayments = 'repayments',
  existing_users = 'existing_users',
}

export enum RepaymentQueueName {
  process_new_repayments = 'process_new_repayments',
  process_liquidation_request = 'process_liquidation_request',
  process_overflow_repayments = 'process_overflow_repayments',
}
