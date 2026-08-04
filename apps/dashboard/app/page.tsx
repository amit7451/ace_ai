import Dotfield from './components/Dotfield';
import Navbar from './components/Navbar';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#08080a] text-zinc-200 overflow-hidden flex flex-col justify-between">
      {/* Interactive Background Dotfield */}
      <Dotfield />

      {/* Top Navbar */}
      <Navbar />

      {/* Hero Content Section */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 pt-24 sm:pt-28 pb-20 flex-1 flex flex-col items-center justify-center text-center">
        {/* Hero Logo Emblem & Main Title */}
        <div className="flex flex-col items-center justify-center mb-8 group w-full">
          <div className="relative mb-5 sm:mb-6">
            {/* Subtle ambient glow behind logo to blend seamlessly with dark BG */}
            <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-zinc-100/20 via-zinc-400/20 to-zinc-100/10 blur-2xl opacity-75 group-hover:opacity-100 transition duration-500"></div>
            <Image
              src="/modbit.webp"
              alt="ModBit Logo"
              width={120}
              height={120}
              priority
              className="relative w-18 sm:w-22 md:w-26 h-auto object-contain filter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          {/* pl-[0.2em] sm:pl-[0.25em] offsets the trailing letter-spacing to achieve 100% exact optical centering */}
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-[0.2em] sm:tracking-[0.25em] pl-[0.2em] sm:pl-[0.25em] text-zinc-100 uppercase cursor-blink text-center">
            ModBit
          </h1>
        </div>

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
