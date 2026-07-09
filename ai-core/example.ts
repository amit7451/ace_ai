import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import {
  LLMProviderFactory,
  MemoryProviderFactory,
  RagOrchestrator,
  RagPromptBuilder,
} from './src';

// NOTE: Since we are not connecting to a real vector store for this example,
// we will mock the IRetriever interface to return dummy data.
import type { IRetriever } from './src/retriever/interfaces/retriever.interface';

async function runExample() {
  console.log('🚀 Initializing AI Chatbot Platform Core Engine (MVP)...\n');

  // 1. Initialize Memory (Component 7)
  const memory = MemoryProviderFactory.create({
    provider: 'in-memory',
    ttlSeconds: 3600,
  });

  // 2. Initialize Prompt Builder (Component 6)
  const promptBuilder = new RagPromptBuilder({
    systemPrompt: 'You are a helpful AI assistant for ACME Corp.',
    contextTemplate: 'Use the following knowledge to answer the user:\n\n{context}',
    fallbackInstruction: 'Politely inform the user that you only answer questions related to ACME Corp.',
    fallbackStrategy: 'instruct_llm',
    maxHistoryMessages: 10,
  });

  // 3. Initialize LLM Provider (Component 1)
  // Now securely loading the Gemini API key from the .env file!
  const llm = LLMProviderFactory.create({
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    temperature: 0.7,
  });

  // 4. Create a Dummy Retriever (Mocking Component 5)
  // In a real app, you would use RetrieverFactory here with your Qdrant config.
  const mockRetriever: IRetriever = {
    async retrieve(retrievalQuery) {
      const { query } = retrievalQuery;
      const isRelevant = query.toLowerCase().includes('acme') || query.toLowerCase().includes('refund');
      return {
        query,
        isRelevant,
        chunks: isRelevant
          ? [{ chunkId: '1', documentId: 'doc1', text: 'ACME Corp offers full refunds within 30 days of purchase.', score: 0.9, sourceType: 'pdf', chunkIndex: 0, tokenCount: 10 }]
          : [],
        totalCandidates: isRelevant ? 1 : 0,
        tookMs: 5,
      };
    },
    async healthCheck() { return true; }
  };

  // 5. Initialize the AI Orchestrator (Component 8)
  const orchestrator = new RagOrchestrator(
    mockRetriever,
    memory,
    promptBuilder,
    llm
  );

  console.log('✅ Core Engine Initialized.\n');
  const sessionId = 'test-session-123';
  const tenantId = 'tenant-acme';
  const assistantId = 'assist-default';

  // --- Turn 1: Relevant Query ---
  const query1 = 'What is the refund policy at ACME?';
  console.log(`👤 User: ${query1}`);
  
  const response1 = await orchestrator.chat({ tenantId, assistantId, sessionId, query: query1 });
  console.log(`🤖 AI: ${response1.content}\n`);

  // --- Turn 2: Follow-up (Testing Memory) ---
  const query2 = 'Is that 30 days from purchase or delivery?';
  console.log(`👤 User: ${query2}`);
  
  const response2 = await orchestrator.chat({ tenantId, assistantId, sessionId, query: query2 });
  console.log(`🤖 AI: ${response2.content}\n`);

  // --- Turn 3: Out of Domain (Testing Guardrails) ---
  const query3 = 'What is the recipe for chocolate chip cookies?';
  console.log(`👤 User: ${query3}`);
  
  const response3 = await orchestrator.chat({ tenantId, assistantId, sessionId, query: query3 });
  console.log(`🤖 AI (Guardrail Triggered): ${response3.content}\n`);
}

runExample().catch((err: any) => {
  console.error('❌ Error running example:');
  console.error(err.message);
  if (err.cause) {
    console.error('--- Cause ---');
    console.error(err.cause);
  }
});
