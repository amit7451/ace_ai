import { JobService } from '../src/services/JobService';
import { Role } from '@ion-ai/auth';
import { QueueName } from '@ion-ai/queue';

describe('JobService RBAC (F3)', () => {
  let jobService: JobService;
  let mockJobRepo: any;
  let mockKnowledgeRepo: any;
  let mockQueueProvider: any;

  beforeEach(() => {
    mockJobRepo = {
      findManyByOrganizationId: jest.fn(),
      findByIdWithSource: jest.fn(),
      updateIngestionJob: jest.fn(),
      deleteFailedJobsByOrganizationId: jest.fn(),
      deleteByIdAndOrganizationId: jest.fn(),
    };
    mockKnowledgeRepo = {
      updateKnowledgeSourceStatus: jest.fn(),
    };
    mockQueueProvider = {
      isPaused: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      cleanFailed: jest.fn(),
      removeJob: jest.fn(),
      addJob: jest.fn(),
    };

    jobService = new JobService(mockJobRepo, mockKnowledgeRepo, mockQueueProvider);
  });

  describe('pauseJobs & resumeJobs RBAC', () => {
    it('should allow ADMIN and OWNER roles to pause ingestion queue', async () => {
      await expect(jobService.pauseJobs(Role.ADMIN)).resolves.toEqual({ success: true });
      expect(mockQueueProvider.pause).toHaveBeenCalledWith(QueueName.INGESTION);

      await expect(jobService.pauseJobs(Role.OWNER)).resolves.toEqual({ success: true });
    });

    it('should reject MEMBER and VIEWER roles when attempting to pause queue', async () => {
      await expect(jobService.pauseJobs(Role.MEMBER)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Admin access required'),
      });

      await expect(jobService.pauseJobs(Role.VIEWER)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should allow ADMIN and OWNER roles to resume ingestion queue', async () => {
      await expect(jobService.resumeJobs(Role.ADMIN)).resolves.toEqual({ success: true });
      expect(mockQueueProvider.resume).toHaveBeenCalledWith(QueueName.INGESTION);
    });

    it('should reject non-admin roles when attempting to resume queue', async () => {
      await expect(jobService.resumeJobs(Role.EDITOR)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Admin access required'),
      });
    });

    it('should enforce ADMIN role when clearing failed jobs', async () => {
      await expect(jobService.clearFailedJobs('org-1', Role.ADMIN)).resolves.toEqual({
        success: true,
      });
      expect(mockQueueProvider.cleanFailed).toHaveBeenCalledWith(QueueName.INGESTION, 'org-1');
      expect(mockJobRepo.deleteFailedJobsByOrganizationId).toHaveBeenCalledWith('org-1');

      await expect(jobService.clearFailedJobs('org-1', Role.MEMBER)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });
});
