export default function SearchPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Knowledge Search (Debugger)</h1>
      <p>Test your knowledge base retrieval using semantic search.</p>

      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>Search Query</h2>
        <form>
          <input
            type="text"
            placeholder="What is Ion AI?"
            style={{ padding: '0.5rem', width: '300px' }}
          />
          <button type="button" style={{ marginLeft: '1rem', padding: '0.5rem' }}>
            Search
          </button>
        </form>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Retrieved Chunks</h2>
        <ul>
          <li>No search performed yet.</li>
        </ul>
      </div>
    </div>
  );
}
