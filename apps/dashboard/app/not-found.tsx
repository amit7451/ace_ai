import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-200 flex flex-col items-center justify-center p-6 text-center font-mono">
      <div className="text-xs text-zinc-500 tracking-widest uppercase mb-2">// 404_NOT_FOUND</div>
      <h1 className="text-4xl font-bold tracking-[0.2em] text-zinc-100 uppercase mb-4">ModBit</h1>
      <p className="text-xs text-zinc-400 max-w-md mb-8">
        THE REQUESTED ROUTE DOES NOT EXIST ON THIS MODBIT NODE.
      </p>
      <Link href="/" className="modbit-btn-primary py-2.5 px-6 text-xs uppercase">
        [ RETURN HOME ]
      </Link>
    </div>
  );
}
