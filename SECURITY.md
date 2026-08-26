# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Ion AI, please report it responsibly:

**Email:** security@ion-ai.com

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Any suggested fixes (optional)

We will acknowledge your report within 48 hours and provide a timeline for resolution.

## Security Measures

Ion AI implements the following security controls:

### Authentication & Authorization

- JWT-based authentication with httpOnly cookies
- Role-based access control (OWNER, ADMIN, EDITOR, VIEWER)
- Password hashing with bcrypt (12 salt rounds)

### Data Protection

- AES-256-GCM encryption for stored API keys
- Key rotation support via `scripts/rotate-encryption-key.ts`
- Environment variable validation at startup (Zod schemas)

### Network Security

- SSRF protection on all outbound requests (crawler, webhook)
- DNS-rebinding prevention with resolution-time IP validation
- CORS restricted to configured frontend origin
- Rate limiting (per-visitor, per-organization, global)
- Nginx security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)

### Infrastructure

- Non-root Docker containers
- Multi-stage builds with minimal Alpine images
- Network isolation (internal bridge for databases)
- Trivy vulnerability scanning in CI pipeline

### Input Validation

- Zod schema validation on all API endpoints
- File upload size limits (5MB)
- Message length limits (configurable)

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## Disclosure Policy

- We will work with you to understand and resolve the issue
- We will not take legal action against researchers who follow responsible disclosure
- We will credit reporters in release notes (unless anonymity is requested)
