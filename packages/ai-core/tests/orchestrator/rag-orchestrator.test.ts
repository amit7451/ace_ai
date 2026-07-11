import { RagOrchestrator } from '../../src/orchestrator/core/rag-orchestrator';
import { OrchestratorError } from '../../src/orchestrator/errors/orchestrator.errors';
import type { IRetriever } from '../../src/retriever/interfaces/retriever.interface';
import type { IMemoryProvider } from '../../src/memory/interfaces/memory-provider.interface';
import type { IPromptBuilder } from '../../src/prompt/interfaces/prompt-builder.interface';
import type { ILLMProvider } from '../../src/llm/interfaces/llm-provider.interface';
import { OutOfDomainError } from '../../src/prompt/errors/prompt.errors';

describe('RagOrchestrator', () => {
  let mockRetriever: jest.Mocked<IRetriever>;
  let mockMemory: jest.Mocked<IMemoryProvider>;
  let mockPromptBuilder: jest.Mocked<IPromptBuilder>;
  let mockLLM: jest.Mocked<ILLMProvider>;
  let orchestrator: RagOrchestrator;

  beforeEach(() => {
    mockRetriever = {
      retrieve: jest.fn(),
      healthCheck: jest.fn(),
    } as any;

    mockMemory = {
      addMessage: jest.fn(),
      addMessages: jest.fn(),
      getHistory: jest.fn(),
      clear: jest.fn(),
      healthCheck: jest.fn(),
    } as any;

    mockPromptBuilder = {
      buildPrompt: jest.fn(),
    } as any;

    mockLLM = {
      complete: jest.fn(),
      stream: jest.fn(),
      healthCheck: jest.fn(),
      name: 'mock',
      model: 'mock-model',
      estimateTokens: jest.fn(),
    } as any;

    orchestrator = new RagOrchestrator(mockRetriever, mockMemory, mockPromptBuilder, mockLLM);
  });

  it('should successfully orchestrate a chat turn', async () => {
    const request = {
      tenantId: 'tenant-1',
      assistantId: 'assist-1',
      sessionId: 'sess-1',
      query: 'What is the refund policy?',
    };

    // 1. Mock retrieval
    const fakeRetrievalResult = {
      isRelevant: true,
      chunks: [],
      query: request.query,
      totalCandidates: 0,
      tookMs: 0,
    };
    mockRetriever.retrieve.mockResolvedValue(fakeRetrievalResult);

    // 2. Mock history
    mockMemory.getHistory.mockResolvedValue([{ role: 'user', content: 'hello' }]);

    // 3. Mock prompt builder
    mockPromptBuilder.buildPrompt.mockResolvedValue([
      { role: 'system', content: 'test' },
      { role: 'user', content: 'What is the refund policy?' },
    ]);

    // 4. Mock LLM response
    const fakeLLMResponse = {
      content: 'Refunds are allowed within 30 days.',
      model: 'test-model',
      provider: 'mock-provider',
      finishReason: 'stop' as const,
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    };
    mockLLM.complete.mockResolvedValue(fakeLLMResponse);

    // Execute
    const response = await orchestrator.chat(request);

    // Verify
    expect(response.content).toBe(fakeLLMResponse.content);
    expect(response.llmResponse).toBe(fakeLLMResponse);
    expect(response.retrievalResult).toBe(fakeRetrievalResult);

    expect(mockRetriever.retrieve).toHaveBeenCalledWith({
      query: request.query,
      tenantId: request.tenantId,
      assistantId: request.assistantId,
    });
    expect(mockMemory.getHistory).toHaveBeenCalledWith(request.sessionId);
    expect(mockPromptBuilder.buildPrompt).toHaveBeenCalledWith({
      query: request.query,
      retrievalResult: fakeRetrievalResult,
      history: [{ role: 'user', content: 'hello' }],
    });
    expect(mockLLM.complete).toHaveBeenCalled();
    expect(mockMemory.addMessages).toHaveBeenCalledWith(request.sessionId, [
      { role: 'user', content: request.query },
      { role: 'assistant', content: fakeLLMResponse.content },
    ]);
  });

  it('should short-circuit and return fallback on OutOfDomainError', async () => {
    const request = {
      tenantId: 'tenant-1',
      assistantId: 'assist-1',
      sessionId: 'sess-1',
      query: 'Out of domain query',
    };

    mockRetriever.retrieve.mockResolvedValue({
      isRelevant: false,
      chunks: [],
      query: request.query,
      totalCandidates: 0,
      tookMs: 0,
    });
    mockMemory.getHistory.mockResolvedValue([]);

    // Prompt Builder throws strict OutOfDomainError
    mockPromptBuilder.buildPrompt.mockRejectedValue(new OutOfDomainError(request.query));

    const response = await orchestrator.chat(request);

    // Verify it short-circuits
    expect(response.content).toContain("don't have enough context");
    expect(mockLLM.complete).not.toHaveBeenCalled(); // LLM is never called!
    expect(mockMemory.addMessages).not.toHaveBeenCalled(); // We don't save out-of-domain failures to history
  });

  it('should wrap unknown errors in OrchestratorError', async () => {
    const request = {
      tenantId: 'tenant-1',
      assistantId: 'assist-1',
      sessionId: 'sess-1',
      query: 'Trigger error',
    };

    mockRetriever.retrieve.mockRejectedValue(new Error('Network error'));

    await expect(orchestrator.chat(request)).rejects.toThrow(OrchestratorError);
  });
});
