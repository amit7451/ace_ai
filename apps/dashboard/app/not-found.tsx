import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-200 flex flex-col items-center justify-center p-6 text-center font-mono">
      <div className="text-xs text-zinc-500 tracking-widest uppercase mb-2">
        {'// 404_NOT_FOUND'}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <Image
          src="/modbit.webp"
          alt="ModBit Logo"
          width={40}
          height={40}
          className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]"
        />
        <h1 className="text-4xl font-bold tracking-[0.2em] text-zinc-100 uppercase">ModBit</h1>
      </div>
      <p className="text-xs text-zinc-400 max-w-md mb-8">
        THE REQUESTED ROUTE DOES NOT EXIST ON THIS MODBIT NODE.
      </p>
      <Link href="/" className="modbit-btn-primary py-2.5 px-6 text-xs uppercase">
        [ RETURN HOME ]
      </Link>
    </div>
  );
}
