import { Queue, QueueOptions } from 'bullmq';
import { IQueueProvider } from '../interfaces/queue.interface';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export class BullMQProvider implements IQueueProvider {
  private queues: Map<string, Queue> = new Map();
  private redisConfig: RedisConfig;

  constructor(redisConfig: RedisConfig) {
    this.redisConfig = redisConfig;
  }

  async isPaused(queueName: string): Promise<boolean> {
    const queue = this.getQueue(queueName);
    return queue.isPaused();
  }

  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queueOptions: QueueOptions = {
        connection: {
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          password: this.redisConfig.password,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5s, 10s, 20s
          },
          removeOnComplete: true,
        },
      };
      this.queues.set(queueName, new Queue(queueName, queueOptions));
    }
    return this.queues.get(queueName)!;
  }

  async addJob<T>(queueName: string, jobName: string, data: T): Promise<string> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data);
    return job.id!;
  }

  async pause(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  async resume(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }

  async cleanFailed(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    // clean 1000 failed jobs, wait 10s grace period
    await queue.clean(0, 1000, 'failed');
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }
}
