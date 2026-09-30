import * as Sentry from '@sentry/nestjs';

export interface JobErrorContext {
  queue?: string;
  job?: string;
  jobId?: string | number;
}

/**
 * Reports a failure from a queue job (@OnQueueFailed) or an event listener (@OnEvent catch),
 * where the global exception filter never sees it.
 */
export function captureJobError(error: unknown, context: JobErrorContext): void {
  Sentry.captureException(error, {
    tags: {
      queue: context.queue,
      job: context.job,
      jobId: context.jobId === undefined ? undefined : String(context.jobId),
    },
  });
}
