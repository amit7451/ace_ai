import type { IPromptBuilder } from '../interfaces/prompt-builder.interface';
import type { PromptRequest } from '../types/prompt-request.types';
import type { LLMMessage } from '../../llm/types/llm-message.types';
import type { PromptConfig, ResolvedPromptConfig } from '../types/prompt-config.types';
import { promptConfigSchema, promptRequestSchema } from '../schemas/prompt-config.schema';
import { OutOfDomainError, PromptValidationError } from '../errors/prompt.errors';
import { compileTemplate } from '../utils/template-compiler';

/**
 * Default implementation of Component 6 (Prompt Builder).
 *
 * Assembles the final `LLMMessage[]` for the LLM Provider Layer, applying
 * domain guardrails based on the retriever's `isRelevant` flag.
 */
export class RagPromptBuilder implements IPromptBuilder {
  private readonly config: ResolvedPromptConfig;

  constructor(config: PromptConfig) {
    this.config = promptConfigSchema.parse(config);
  }

  /**
   * Assembles the prompt, strictly applying domain guardrails.
   *
   * @param rawRequest - The unvalidated prompt request.
   * @returns The assembled array of LLM messages.
   * @throws {PromptValidationError} If the request fails Zod validation.
   * @throws {OutOfDomainError} If `fallbackStrategy === 'throw_error'` and `isRelevant === false`.
   * @throws {PromptTemplateError} If `contextTemplate` lacks `{context}`.
   */
  public async buildPrompt(rawRequest: PromptRequest): Promise<LLMMessage[]> {
    // 1. Validate incoming request
    const parsed = promptRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      throw new PromptValidationError('Invalid prompt request provided.', parsed.error.format());
    }
    const request = parsed.data;

    const { query, retrievalResult, history } = request;

    // 2. Truncate history if maxHistoryMessages is configured
    let activeHistory = history;
    if (
      this.config.maxHistoryMessages !== undefined &&
      history.length > this.config.maxHistoryMessages
    ) {
      // Keep the most recent `maxHistoryMessages`
      activeHistory = history.slice(-this.config.maxHistoryMessages);
    }

    // 3. Domain Guardrail Enforcement
    if (!retrievalResult.isRelevant) {
      if (this.config.fallbackStrategy === 'throw_error') {
        throw new OutOfDomainError(query);
      }

      // Instruct the LLM to politely decline using the persona
      const fallbackSystemMessage: LLMMessage = {
        role: 'system',
        content: `${this.config.systemPrompt}\n\n${this.config.fallbackInstruction}`,
      };

      const userMessage: LLMMessage = {
        role: 'user',
        content: query,
      };

      return [fallbackSystemMessage, ...activeHistory, userMessage];
    }

    // 4. Format the retrieved context
    const contextText = retrievalResult.chunks.map((chunk) => chunk.text).join('\n\n---\n\n');

    const formattedContext = compileTemplate(this.config.contextTemplate, { context: contextText });

    // 5. Assemble the final prompt array
    const systemMessage: LLMMessage = {
      role: 'system',
      content: `${this.config.systemPrompt}\n\n${formattedContext}`,
    };

    const userMessage: LLMMessage = {
      role: 'user',
      content: query,
    };

    return [systemMessage, ...activeHistory, userMessage];
  }
}
