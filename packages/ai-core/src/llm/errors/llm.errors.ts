import { extractRetryAfter } from '../../embedding/utils/retry-after';

export type KeySourceType = 'SYSTEM_FREE_TIER' | 'ORGANIZATION_CUSTOM_KEY' | 'NONE';

export type LLMErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INVALID_REQUEST_ERROR'
  | 'PROVIDER_UNAVAILABLE_ERROR'
  | 'CONTEXT_LENGTH_ERROR'
  | 'UNKNOWN_ERROR';

export interface InstitutionSupportInfo {
  institutionName?: string;
  supportEmail?: string;
  supportWebsite?: string;
  supportPhone?: string;
  introductoryMessage?: string;
}

export type AIErrorCategory =
  | 'FREE_TIER_QUOTA'
  | 'GLOBAL_SHARED_KEY_QUOTA'
  | 'CUSTOM_KEY_QUOTA'
  | 'RATE_LIMIT'
  | 'AUTHENTICATION'
  | 'CONTEXT_LIMIT'
  | 'PROVIDER_DOWN'
  | 'EMBEDDING'
  | 'MODERATION'
  | 'UNKNOWN';

export type AIErrorActionType =
  | 'NAVIGATE_TO_SETTINGS'
  | 'UPDATE_CUSTOM_KEY'
  | 'CONTACT_ADMINISTRATOR'
  | 'WAIT_AND_RETRY'
  | 'UPGRADE_PROVIDER_PLAN'
  | 'TRUNCATE_HISTORY'
  | 'RETRY_NOW'
  | 'DISMISS';

export interface StructuredAIError {
  code: string;
  category: AIErrorCategory;
  message: string;
  keySource: KeySourceType;
  provider: string;
  retryAfterSeconds?: number;
  resetTimestamp?: string;
  institutionSupport?: InstitutionSupportInfo;
  actionableResolution: {
    type: AIErrorActionType;
    title: string;
    description: string;
    primaryButton: {
      label: string;
      action: AIErrorActionType;
      targetUrl?: string;
    };
    secondaryButton?: {
      label: string;
      action: AIErrorActionType;
      targetUrl?: string;
    };
  };
  details?: Record<string, any>;
}

export interface LLMErrorContext {
  provider: string;
  model?: string;
  statusCode?: number;
  cause?: unknown;
  keySource?: KeySourceType;
  retryAfterMs?: number;
  institutionSupport?: InstitutionSupportInfo;
}

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly provider: string;
  readonly model?: string;
  readonly statusCode?: number;
  readonly cause?: unknown;
  readonly keySource: KeySourceType;
  readonly retryAfterMs?: number;
  readonly institutionSupport?: InstitutionSupportInfo;

  constructor(message: string, code: LLMErrorCode, context: LLMErrorContext) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.provider = context.provider;
    this.model = context.model;
    this.statusCode = context.statusCode;
    this.cause = context.cause;
    this.keySource = context.keySource || 'SYSTEM_FREE_TIER';
    this.retryAfterMs = context.retryAfterMs;
    this.institutionSupport = context.institutionSupport;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toStructuredAIError(opts?: {
    keySource?: KeySourceType;
    clientContext?: 'playground' | 'widget';
    institutionSupport?: InstitutionSupportInfo;
  }): StructuredAIError {
    const activeKeySource = opts?.keySource || this.keySource;
    const isWidget = opts?.clientContext === 'widget';
    const support = opts?.institutionSupport || this.institutionSupport;
    const retryAfterSec = this.retryAfterMs ? Math.ceil(this.retryAfterMs / 1000) : 60;

    // Handle widget specific contact admin requirement
    if (isWidget && (this.code === 'RATE_LIMIT_ERROR' || this.code === 'AUTHENTICATION_ERROR')) {
      const emailText = support?.supportEmail ? ` (${support.supportEmail})` : '';
      const phoneText = support?.supportPhone ? ` or phone ${support.supportPhone}` : '';
      return {
        code: 'WIDGET_TOKEN_LIMIT_REACHED',
        category: 'RATE_LIMIT',
        message: `Token usage limit reached for ${support?.institutionName || 'this institution'}. Please contact administrator${emailText}${phoneText}.`,
        keySource: activeKeySource,
        provider: this.provider,
        retryAfterSeconds: retryAfterSec,
        institutionSupport: support,
        actionableResolution: {
          type: 'CONTACT_ADMINISTRATOR',
          title: 'Token Usage Limit Reached',
          description: `The conversation limit for ${support?.institutionName || 'this service'} has been reached. Please contact your institution administrator.`,
          primaryButton: {
            label: support?.supportEmail
              ? `Contact Admin (${support.supportEmail})`
              : 'Contact Administrator',
            action: 'CONTACT_ADMINISTRATOR',
            targetUrl:
              support?.supportWebsite ||
              (support?.supportEmail ? `mailto:${support.supportEmail}` : undefined),
          },
          secondaryButton: {
            label: 'Dismiss',
            action: 'DISMISS',
          },
        },
      };
    }

    if (this.code === 'RATE_LIMIT_ERROR') {
      if (activeKeySource === 'SYSTEM_FREE_TIER') {
        return {
          code: 'FREE_TIER_QUOTA_EXCEEDED',
          category: 'FREE_TIER_QUOTA',
          message: `Free tier rate limit hit for ${this.provider}. Configure your API key for higher limits.`,
          keySource: 'SYSTEM_FREE_TIER',
          provider: this.provider,
          retryAfterSeconds: retryAfterSec,
          institutionSupport: support,
          actionableResolution: {
            type: 'NAVIGATE_TO_SETTINGS',
            title: 'Free Usage Limit Reached',
            description: `You have reached the free tier usage limit for ${this.provider}. You can wait for the reset timer or configure your own API key to continue without limits.`,
            primaryButton: {
              label: 'Configure API Key',
              action: 'NAVIGATE_TO_SETTINGS',
              targetUrl: '/settings',
            },
            secondaryButton: {
              label: 'Wait to Reset',
              action: 'WAIT_AND_RETRY',
            },
          },
        };
      } else {
        return {
          code: 'CUSTOM_KEY_QUOTA_EXCEEDED',
          category: 'CUSTOM_KEY_QUOTA',
          message: `Rate limit or quota exceeded on your configured ${this.provider} API Key.`,
          keySource: 'ORGANIZATION_CUSTOM_KEY',
          provider: this.provider,
          retryAfterSeconds: retryAfterSec,
          institutionSupport: support,
          actionableResolution: {
            type: 'UPDATE_CUSTOM_KEY',
            title: 'API Key Quota Exceeded',
            description: `Your configured ${this.provider} API key has reached its rate limit or billing quota. Please provide another key or check your billing status.`,
            primaryButton: {
              label: 'Update API Key',
              action: 'UPDATE_CUSTOM_KEY',
              targetUrl: '/settings',
            },
            secondaryButton: {
              label: 'Upgrade Plan',
              action: 'UPGRADE_PROVIDER_PLAN',
              targetUrl:
                this.provider === 'openai'
                  ? 'https://platform.openai.com/account/billing'
                  : 'https://aistudio.google.com/',
            },
          },
        };
      }
    }

    if (this.code === 'AUTHENTICATION_ERROR') {
      return {
        code: 'INVALID_API_KEY',
        category: 'AUTHENTICATION',
        message: `Authentication failed for ${this.provider}. Please verify your API key.`,
        keySource: activeKeySource,
        provider: this.provider,
        institutionSupport: support,
        actionableResolution: {
          type: 'UPDATE_CUSTOM_KEY',
          title: 'Invalid API Key',
          description: `The API key provided for ${this.provider} is invalid, expired, or revoked.`,
          primaryButton: {
            label: 'Update API Key',
            action: 'UPDATE_CUSTOM_KEY',
            targetUrl: '/settings',
          },
        },
      };
    }

    if (this.code === 'CONTEXT_LENGTH_ERROR') {
      return {
        code: 'CONTEXT_WINDOW_EXCEEDED',
        category: 'CONTEXT_LIMIT',
        message: `Request exceeded max context token window for model "${this.model || this.provider}".`,
        keySource: activeKeySource,
        provider: this.provider,
        institutionSupport: support,
        actionableResolution: {
          type: 'TRUNCATE_HISTORY',
          title: 'Message History Too Long',
          description:
            'The length of this conversation exceeds the model context window. Truncate conversation history to continue.',
          primaryButton: {
            label: 'Clear / Shorten Chat',
            action: 'TRUNCATE_HISTORY',
          },
          secondaryButton: {
            label: 'Dismiss',
            action: 'DISMISS',
          },
        },
      };
    }

    if (this.code === 'PROVIDER_UNAVAILABLE_ERROR') {
      return {
        code: 'PROVIDER_DOWN',
        category: 'PROVIDER_DOWN',
        message: `Provider ${this.provider} is currently experiencing outage or high load.`,
        keySource: activeKeySource,
        provider: this.provider,
        retryAfterSeconds: 30,
        institutionSupport: support,
        actionableResolution: {
          type: 'RETRY_NOW',
          title: 'AI Service Temporarily Unavailable',
          description: `The AI provider (${this.provider}) returned a temporary server error. Please try again shortly.`,
          primaryButton: {
            label: 'Retry Now',
            action: 'RETRY_NOW',
          },
        },
      };
    }

    return {
      code: 'UNKNOWN_AI_ERROR',
      category: 'UNKNOWN',
      message: this.message || 'An unexpected AI model error occurred.',
      keySource: activeKeySource,
      provider: this.provider,
      institutionSupport: support,
      actionableResolution: {
        type: 'RETRY_NOW',
        title: 'Unexpected Error',
        description: this.message || 'An unexpected error occurred during request execution.',
        primaryButton: {
          label: 'Retry',
          action: 'RETRY_NOW',
        },
      },
    };
  }
}

export class LLMAuthenticationError extends LLMError {
  constructor(context: LLMErrorContext) {
    super(
      `Authentication failed for provider "${context.provider}". Check the configured API key.`,
      'AUTHENTICATION_ERROR',
      context
    );
    this.name = 'LLMAuthenticationError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(context: LLMErrorContext) {
    super(`Rate limit exceeded for provider "${context.provider}".`, 'RATE_LIMIT_ERROR', context);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(context: LLMErrorContext) {
    super(`Request to provider "${context.provider}" timed out.`, 'TIMEOUT_ERROR', context);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMInvalidRequestError extends LLMError {
  constructor(message: string, context: LLMErrorContext) {
    super(message, 'INVALID_REQUEST_ERROR', context);
    this.name = 'LLMInvalidRequestError';
  }
}

export class LLMProviderUnavailableError extends LLMError {
  constructor(context: LLMErrorContext) {
    super(
      `Provider "${context.provider}" is currently unavailable. Please retry shortly.`,
      'PROVIDER_UNAVAILABLE_ERROR',
      context
    );
    this.name = 'LLMProviderUnavailableError';
  }
}

export class LLMContextLengthError extends LLMError {
  constructor(context: LLMErrorContext) {
    super(
      `Request to provider "${context.provider}" exceeded the model's maximum context length.`,
      'CONTEXT_LENGTH_ERROR',
      context
    );
    this.name = 'LLMContextLengthError';
  }
}

export class LLMUnknownError extends LLMError {
  constructor(message: string, context: LLMErrorContext) {
    super(message, 'UNKNOWN_ERROR', context);
    this.name = 'LLMUnknownError';
  }
}

export function mapHttpStatusToError(
  status: number,
  provider: string,
  message: string,
  model?: string,
  keySource?: KeySourceType,
  retryAfterMs?: number
): LLMError {
  const ctx: LLMErrorContext = { provider, model, statusCode: status, keySource, retryAfterMs };

  switch (status) {
    case 401:
    case 403:
      return new LLMAuthenticationError(ctx);
    case 408:
      return new LLMTimeoutError(ctx);
    case 429:
      return new LLMRateLimitError(ctx);
    case 400:
    case 404:
    case 422:
      if (
        message.includes('context') ||
        message.includes('maximum context length') ||
        message.includes('token count')
      ) {
        return new LLMContextLengthError(ctx);
      }
      return new LLMInvalidRequestError(
        message || `Invalid request sent to provider "${provider}".`,
        ctx
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return new LLMProviderUnavailableError(ctx);
    default:
      return new LLMUnknownError(message || `Unexpected error from provider "${provider}".`, ctx);
  }
}

export interface HttpErrorLike {
  status: number;
  headers?: { get(name: string): string | null } | Record<string, any>;
  text(): Promise<string>;
}

export async function mapHttpErrorResponse(
  response: HttpErrorLike,
  provider: string,
  model?: string,
  keySource?: KeySourceType,
  retryAfterMs?: number
): Promise<LLMError> {
  const body = await response.text();
  const calculatedRetryAfterMs = retryAfterMs ?? extractRetryAfter(response.headers, body);
  return mapHttpStatusToError(
    response.status,
    provider,
    body,
    model,
    keySource,
    calculatedRetryAfterMs
  );
}
