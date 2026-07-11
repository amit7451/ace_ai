export enum QueueName {
  INGESTION = 'ingestion-queue',
  CRAWLER = 'crawler-queue',
}

export enum JobName {
  UPLOAD = 'upload-job',
  CRAWL = 'crawl-job',
  REINDEX = 'reindex-job',
  DELETE = 'delete-job',
}

export interface UploadJobPayload {
  organizationId: string;
  knowledgeSourceId: string;
  documentId: string;
  storageKey: string;
  mimeType: string;
}

export interface CrawlJobPayload {
  organizationId: string;
  crawlJobId: string;
  url: string;
}

export interface ReindexJobPayload {
  organizationId: string;
  knowledgeSourceId: string;
}

export interface DeleteJobPayload {
  organizationId: string;
  knowledgeSourceId: string;
  documentId: string;
  storageKey: string;
}
