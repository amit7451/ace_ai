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

/**
 * The concrete implementation of Component 8 (AI Orchestrator).
 * It wires together Retriever (5), Memory (7), Prompt Builder (6), and LLM (1).
 */
export class RagOrchestrator implements IAIOrchestrator {
  constructor(
    private readonly retriever: IRetriever,
    private readonly memory: IMemoryProvider,
    private readonly promptBuilder: IPromptBuilder,
    private readonly llm: ILLMProvider,
  ) {}

  async chat(rawRequest: ChatRequest): Promise<ChatResponse> {
    // 1. Validate Input
    const parsed = chatRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      throw new OrchestratorError('Invalid chat request', parsed.error);
    }
    const { tenantId, assistantId, sessionId, query } = parsed.data;

    try {
      // 2. Retrieve Knowledge (Component 5)
      const retrievalResult = await this.retriever.retrieve({ query, tenantId, assistantId });

      // 3. Fetch Conversation History (Component 7)
      const history = await this.memory.getHistory(sessionId);

      // 4. Build Prompt (Component 6)
      let messages: LLMMessage[];
      try {
        messages = await this.promptBuilder.buildPrompt({
          query,
          retrievalResult,
          history,
        });
      } catch (err) {
        if (err instanceof OutOfDomainError) {
          // If guardrails strictly prevent answering without context, short-circuit
          return {
            content: "I'm sorry, I don't have enough context to answer that question.",
            retrievalResult,
          };
        }
        throw err;
      }

      // 5. Execute LLM (Component 1)
      const llmResponse = await this.llm.complete(messages);

      // 6. Persist Memory (Component 7)
      // Save both the user's turn and the assistant's turn
      await this.memory.addMessages(sessionId, [
        { role: 'user', content: query },
        { role: 'assistant', content: llmResponse.content },
      ]);

      // 7. Return Final Response
      return {
        content: llmResponse.content,
        llmResponse,
        retrievalResult,
      };
    } catch (err) {
      if (err instanceof OrchestratorError) {
        throw err;
      }
      throw new OrchestratorError('Failed to execute chat orchestration pipeline', err);
    }
  }
}
