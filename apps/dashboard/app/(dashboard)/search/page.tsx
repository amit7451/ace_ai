'use client';

export default function SearchPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Knowledge Search (Debugger)</h1>
      <p className="text-gray-600 mb-6">
        Test your knowledge base retrieval using semantic search.
      </p>

      <div className="p-4 border rounded-md max-w-lg mb-6">
        <h2 className="text-lg font-semibold mb-3">Search Query</h2>
        <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
          <input
            type="text"
            placeholder="What is ModBit?"
            className="p-2 border rounded-md flex-1 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-md">
            Search
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Retrieved Chunks</h2>
        <p className="text-sm text-gray-500">No search performed yet.</p>
      </div>
    </div>
  );
}
