import type { JobsOptions } from 'bullmq';

export const opts: JobsOptions = {
  removeOnComplete: true,
  removeOnFail: 50,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
};
