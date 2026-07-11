import type { IAIOrchestrator } from '../interfaces/orchestrator.interface';
import type { ChatRequest, ChatResponse } from '../types/chat.types';
import { chatRequestSchema } from '../schemas/chat.schema';
import { OrchestratorError } from '../errors/orchestrator.errors';
import type { IRetriever } from '../../retriever/interfaces/retriever.interface';
import type { IMemoryProvider } from '../../memory/interfaces/memory-provider.interface';
import type { IPromptBuilder } from '../../prompt/interfaces/prompt-builder.interface';
import type { ILLMProvider } from '../../llm/interfaces/llm-provider.interface';
import { OutOfDomainError } from '../../prompt/errors/prompt.errors';
import type { LLMMessage } from '../../llm/types/llm-message.types';
import type { ChatStreamChunk } from '../interfaces/orchestrator.interface';

/**
 * The concrete implementation of Component 8 (AI Orchestrator).
 * It wires together Retriever (5), Memory (7), Prompt Builder (6), and LLM (1).
 */
export class RagOrchestrator implements IAIOrchestrator {
  constructor(
    private readonly retriever: IRetriever,
    private readonly memory: IMemoryProvider,
    private readonly promptBuilder: IPromptBuilder,
    private readonly llm: ILLMProvider
  ) {}

  private async preparePipeline(rawRequest: ChatRequest) {
    const parsed = chatRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      throw new OrchestratorError('Invalid chat request', parsed.error);
    }
    const { tenantId, assistantId, sessionId, query } = parsed.data;

    const retrievalResult = await this.retriever.retrieve({ query, tenantId, assistantId });
    const history = await this.memory.getHistory(sessionId);

    let messages: LLMMessage[];
    try {
      messages = await this.promptBuilder.buildPrompt({
        query,
        retrievalResult,
        history,
      });
    } catch (err) {
      if (err instanceof OutOfDomainError) {
        return { shortCircuit: true, query, sessionId, retrievalResult, messages: [] };
      }
      throw err;
    }

    return { shortCircuit: false, query, sessionId, retrievalResult, messages };
  }

  async chat(rawRequest: ChatRequest): Promise<ChatResponse> {
    try {
      const { shortCircuit, query, sessionId, retrievalResult, messages } =
        await this.preparePipeline(rawRequest);

      if (shortCircuit) {
        return {
          content: "I'm sorry, I don't have enough context to answer that question.",
          retrievalResult,
        };
      }

      const llmResponse = await this.llm.complete(messages!);

      await this.memory.addMessages(sessionId, [
        { role: 'user', content: query },
        { role: 'assistant', content: llmResponse.content },
      ]);

      return {
        content: llmResponse.content,
        llmResponse,
        retrievalResult,
      };
    } catch (err) {
      if (err instanceof OrchestratorError) throw err;
      throw new OrchestratorError('Failed to execute chat orchestration pipeline', err);
    }
  }

  async *stream(rawRequest: ChatRequest): AsyncGenerator<ChatStreamChunk, void, unknown> {
    try {
      const { shortCircuit, query, sessionId, retrievalResult, messages } =
        await this.preparePipeline(rawRequest);

      // Yield citations immediately so the UI can render them while streaming
      yield { type: 'citation', citations: retrievalResult?.chunks || [] };

      if (shortCircuit) {
        const content = "I'm sorry, I don't have enough context to answer that question.";
        yield { type: 'chunk', content };
        return;
      }

      const stream = this.llm.stream(messages!);
      let fullContent = '';

      for await (const chunk of stream) {
        fullContent += chunk.delta;
        yield { type: 'chunk', content: chunk.delta };
      }

      await this.memory.addMessages(sessionId, [
        { role: 'user', content: query },
        { role: 'assistant', content: fullContent },
      ]);
    } catch (err) {
      if (err instanceof OrchestratorError) {
        yield { type: 'error', error: err.message };
      } else {
        yield { type: 'error', error: 'Failed to execute stream orchestration pipeline' };
      }
    }
  }
}
