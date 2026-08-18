# Production Architecture & Deployment Guide: Ion AI

This guide details the recommended production architecture on AWS, contrasting a single-node Docker Compose setup with an enterprise-grade cloud deployment.

---

## 1. Single-Node vs. True Cloud Production Architecture

```
                                      AWS Route 53 (DNS)
                                              │
                                              ▼
                                 AWS CloudFront (CDN & WAF)
                                              │
                                              ▼
                           AWS Application Load Balancer (ALB)
                                  [HTTPS Termination (ACM)]
                                              │
                        ┌─────────────────────┴─────────────────────┐
                        │                                           │
                        ▼                                           ▼
             Next.js Dashboard Tasks                      Fastify API Tasks
             (AWS ECS Fargate)                           (AWS ECS Fargate)
             [Autoscaled 2-10 tasks]                     [Autoscaled 2-20 tasks]
                        │                                           │
                        │                       ┌───────────────────┼───────────────────┐
                        │                       │                   │                   │
                        ▼                       ▼                   ▼                   ▼
                 Ingestion / Crawler     AWS RDS PostgreSQL   AWS ElastiCache    Qdrant Vector DB
                    Worker Tasks           (Multi-AZ Engine)      (Redis 7.4)     (Managed Cloud or
                 (AWS ECS Fargate)       - Automatic Backups   - BullMQ Queues    Dedicated ECS Cluster)
                 [Autoscaled 1-8 tasks]  - Read Replicas       - Rate Limiting    - HNSW Vector Index
```

### Key Differences:

| Component              | Single-Node Compose (`docker-compose.prod.yml`) | Enterprise Production (AWS Architecture)                                                              |
| :--------------------- | :---------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **High Availability**  | Single VM (SPOF)                                | Multi-AZ across 3 Availability Zones                                                                  |
| **PostgreSQL**         | Containerized on local volume                   | **AWS RDS Aurora PostgreSQL** (Multi-AZ, automated point-in-time recovery, automated daily snapshots) |
| **Redis**              | Containerized on local volume                   | **AWS ElastiCache Redis / Valkey** (Multi-AZ failover, clustered replication)                         |
| **Vector Database**    | Single-container Qdrant                         | **Qdrant Cloud Managed** or distributed Qdrant cluster on ECS with EBS io2 / gp3 persistence          |
| **Object Storage**     | Cloudflare R2 / AWS S3                          | **Cloudflare R2 / AWS S3** with server-side encryption (`aws:kms`) and lifecycle rules                |
| **Ingress & TLS**      | Nginx on host port 80/443                       | **AWS ALB + CloudFront + AWS WAF + ACM Managed TLS Certificates**                                     |
| **Compute Scaling**    | Fixed single container                          | **AWS ECS Fargate / EKS** with CPU/Memory auto-scaling policies                                       |
| **Secrets Management** | `.env` file injected                            | **AWS Secrets Manager** / **AWS Systems Manager Parameter Store**                                     |

---

## 2. Production Hardening Implemented in `docker-compose.prod.yml`

For single-server or staging environments, `docker-compose.prod.yml` has been hardened with:

1. **Pinned Semantic Images**:
   - `postgres:16.4-alpine3.20` (not `:latest` or unpinned tags)
   - `redis:7.4.1-alpine3.20`
   - `qdrant/qdrant:v1.12.1`
   - `nginx:alpine`
2. **Network Isolation**:
   - All backend databases (`postgres`, `redis`, `qdrant`), the API, and the worker communicate exclusively over the internal bridge network `ion-internal`.
   - No database or internal microservice ports (`5432`, `6379`, `6333`, `3001`) are exposed to the public host. Only the Nginx reverse proxy listens on `80` and `443`.
3. **Container Resource Quotas**:
   - CPU and Memory resource limits (`deploy.resources.limits` and `reservations`) configured for each container to eliminate OOM cascading failures.
4. **Log Rotation**:
   - Docker `json-file` logging driver configured with `max-size: 50m` and `max-file: 5` across all services to prevent disk exhaustion.
5. **Multi-Stage Non-Root Builds**:
   - API runs as `ionuser` (UID 10001).
   - Dashboard runs as `nextjs` (UID 10001).
   - Worker runs as `workeruser` (UID 10001) with sandboxed Chromium.

---

## 3. Embedding Model Migration & Reindexing Workflow

When switching embedding models (e.g. from Gemini `768d` to OpenAI `1536d` or Cohere `1024d`):

1. **Detection**:
   - When an organization updates `embeddingProvider` or `embeddingModel` via `PATCH /api/v1/configuration`, the system checks for existing ingested documents.
   - If documents exist, the API flags `reindexRequired: true` with the count of affected documents.
2. **Reindexing Action**:
   - Admin triggers `POST /api/v1/knowledge/reindex` (or via the Settings dashboard).
   - The platform purges old chunk metadata and enqueues all active documents to BullMQ `QueueName.INGESTION`.
   - The worker initializes a collection with the new vector dimensions in Qdrant and re-embeds all documents with zero document loss.
