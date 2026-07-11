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
}
