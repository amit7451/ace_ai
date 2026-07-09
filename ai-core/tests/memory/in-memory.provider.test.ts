import { InMemoryMemoryProvider } from '../../src/memory/providers/in-memory/in-memory.provider';
import type { LLMMessage } from '../../src/llm/types/llm-message.types';

describe('InMemoryMemoryProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize and pass healthcheck', async () => {
    const provider = new InMemoryMemoryProvider({ provider: 'in-memory' });
    expect(await provider.healthCheck()).toBe(true);
  });

  it('should add and retrieve messages', async () => {
    const provider = new InMemoryMemoryProvider({ provider: 'in-memory' });
    const msg: LLMMessage = { role: 'user', content: 'Hello' };
    
    await provider.addMessage('session1', msg);
    const history = await provider.getHistory('session1');
    
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(msg);
  });

  it('should add multiple messages at once', async () => {
    const provider = new InMemoryMemoryProvider({ provider: 'in-memory' });
    const msgs: LLMMessage[] = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello there' },
    ];
    
    await provider.addMessages('session2', msgs);
    const history = await provider.getHistory('session2');
    
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
  });

  it('should limit history retrieved', async () => {
    const provider = new InMemoryMemoryProvider({ provider: 'in-memory' });
    const msgs: LLMMessage[] = [
      { role: 'user', content: '1' },
      { role: 'assistant', content: '2' },
      { role: 'user', content: '3' },
    ];
    
    await provider.addMessages('session3', msgs);
    const history = await provider.getHistory('session3', 2);
    
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('2');
    expect(history[1].content).toBe('3');
  });

  it('should clear session history', async () => {
    const provider = new InMemoryMemoryProvider({ provider: 'in-memory' });
    await provider.addMessage('session4', { role: 'user', content: 'test' });
    await provider.clear('session4');
    
    const history = await provider.getHistory('session4');
    expect(history).toHaveLength(0);
  });

  it('should silently prune expired sessions if TTL is set', async () => {
    const provider = new InMemoryMemoryProvider({ provider: 'in-memory', ttlSeconds: 10 });
    await provider.addMessage('session5', { role: 'user', content: 'expire me' });
    
    // Fast-forward 11 seconds
    jest.advanceTimersByTime(11000);
    
    const history = await provider.getHistory('session5');
    expect(history).toHaveLength(0); // Should be pruned
  });
});
