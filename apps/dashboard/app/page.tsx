import Dotfield from './components/Dotfield';
import Navbar from './components/Navbar';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#08080a] text-zinc-200 overflow-hidden flex flex-col justify-between">
      {/* Interactive Background Dotfield */}
      <Dotfield />

      {/* Top Navbar */}
      <Navbar />

      {/* Hero Content Section */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 pt-36 pb-20 flex-1 flex flex-col items-center justify-center text-center">
        {/* Main Title: ModBit in bold typewriter spaced font */}
        <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-[0.2em] sm:tracking-[0.25em] text-zinc-100 uppercase mb-8 cursor-blink">
          ModBit
        </h1>

        {/* Simple & Clear Project Message */}
        <p className="text-base sm:text-lg text-zinc-300 font-mono max-w-xl mx-auto leading-relaxed mb-10 tracking-wide">
          A simple, modular platform to connect, manage, and scale workspace solutions for your
          organization.
        </p>

        {/* Primary Action Button - Starts the sequential flow */}
        <div>
          <Link
            href="/login"
            className="inline-block px-10 py-4 modbit-btn-primary text-sm sm:text-base tracking-[0.2em] corner-border"
          >
            [ GET STARTED ]
          </Link>
        </div>
      </main>

      {/* Minimal Clean Footer */}
      <footer className="relative z-10 border-t border-zinc-900 bg-[#08080a]/90 py-6 px-6 text-center text-xs text-zinc-500 font-mono tracking-widest">
        MODBIT &copy; 2026 // ALL RIGHTS RESERVED
      </footer>
    </div>
  );
}
