export interface QueueJobOptions {
  jobId?: string;
  delay?: number;
  attempts?: number;
  priority?: number;
}

export interface IQueueProvider {
  /**
   * Adds a job to the queue.
   * @param queueName The name of the queue.
   * @param jobName The name of the job.
   * @param data The payload for the job.
   * @param opts Optional job options (such as custom jobId).
   */
  addJob<T>(queueName: string, jobName: string, data: T, opts?: QueueJobOptions): Promise<string>;
  pause(queueName: string): Promise<void>;
  resume(queueName: string): Promise<void>;
  cleanFailed(queueName: string, organizationId?: string): Promise<void>;
  removeJob(queueName: string, jobId: string): Promise<void>;
  isPaused(queueName: string): Promise<boolean>;
  close(): Promise<void>;
}
