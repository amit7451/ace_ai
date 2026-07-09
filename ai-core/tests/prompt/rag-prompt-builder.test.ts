import { RagPromptBuilder } from '../../src/prompt/builder/rag-prompt-builder';
import { PromptConfig } from '../../src/prompt/types/prompt-config.types';
import { PromptRequest } from '../../src/prompt/types/prompt-request.types';
import { OutOfDomainError, PromptTemplateError, PromptValidationError } from '../../src/prompt/errors/prompt.errors';

describe('RagPromptBuilder', () => {
  const defaultConfig: PromptConfig = {
    systemPrompt: 'You are a test assistant.',
    contextTemplate: 'Context:\n{context}',
    fallbackInstruction: 'I cannot answer this.',
    fallbackStrategy: 'instruct_llm',
  };

  const createRequest = (isRelevant: boolean, chunks: string[] = [], query = 'Hello'): PromptRequest => ({
    query,
    retrievalResult: {
      query,
      isRelevant,
      chunks: chunks.map((text, i) => ({
        chunkId: String(i),
        documentId: 'doc1',
        text,
        score: 0.9,
        sourceType: 'test',
        chunkIndex: i,
        tokenCount: 10,
      })),
      totalCandidates: chunks.length,
      tookMs: 10,
    },
    history: [],
  });

  describe('Initialization', () => {
    it('should initialize with valid config', () => {
      const builder = new RagPromptBuilder(defaultConfig);
      expect(builder).toBeInstanceOf(RagPromptBuilder);
    });

    it('should throw if contextTemplate lacks {context}', async () => {
      const builder = new RagPromptBuilder({
        ...defaultConfig,
        contextTemplate: 'Bad template missing variable',
      });
      await expect(builder.buildPrompt(createRequest(true, ['chunk']))).rejects.toThrow(PromptTemplateError);
    });
  });

  describe('buildPrompt()', () => {
    it('should build prompt successfully with relevant context', async () => {
      const builder = new RagPromptBuilder(defaultConfig);
      const request = createRequest(true, ['Knowledge piece 1', 'Knowledge piece 2']);
      
      const messages = await builder.buildPrompt(request);
      
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('You are a test assistant.');
      expect(messages[0].content).toContain('Knowledge piece 1');
      expect(messages[0].content).toContain('Knowledge piece 2');
      
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Hello');
    });

    it('should apply instruct_llm fallback when isRelevant is false', async () => {
      const builder = new RagPromptBuilder({ ...defaultConfig, fallbackStrategy: 'instruct_llm' });
      const request = createRequest(false);
      
      const messages = await builder.buildPrompt(request);
      
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('You are a test assistant.');
      expect(messages[0].content).toContain('I cannot answer this.');
      
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Hello');
    });

    it('should throw OutOfDomainError when fallback is throw_error and isRelevant is false', async () => {
      const builder = new RagPromptBuilder({ ...defaultConfig, fallbackStrategy: 'throw_error' });
      const request = createRequest(false);
      
      await expect(builder.buildPrompt(request)).rejects.toThrow(OutOfDomainError);
    });

    it('should truncate history if maxHistoryMessages is reached', async () => {
      const builder = new RagPromptBuilder({ ...defaultConfig, maxHistoryMessages: 2 });
      const request = createRequest(true, ['chunk']);
      request.history = [
        { role: 'user', content: 'Old1' },
        { role: 'assistant', content: 'Old2' },
        { role: 'user', content: 'Keep1' },
        { role: 'assistant', content: 'Keep2' },
      ];
      
      const messages = await builder.buildPrompt(request);
      
      // system + 2 history + user = 4
      expect(messages).toHaveLength(4);
      expect(messages[1].content).toBe('Keep1');
      expect(messages[2].content).toBe('Keep2');
    });

    it('should throw PromptValidationError on bad request', async () => {
      const builder = new RagPromptBuilder(defaultConfig);
      // Pass completely invalid request shape
      await expect(builder.buildPrompt({} as any)).rejects.toThrow(PromptValidationError);
    });
  });
});
