export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">ION AI Dashboard</h1>
      <p className="text-xl text-gray-600">Welcome to Phase 1 Foundation</p>
      <div className="mt-8 flex gap-4">
        <a href="/login" className="px-4 py-2 bg-blue-600 text-white rounded-md">
          Login
        </a>
        <a href="/register" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">
          Register
        </a>
      </div>
    </main>
  );
}
