'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Dotfield from './components/Dotfield';
import Navbar from './components/Navbar';
import HowItWorks, { ScrollArrow } from './components/HowItWorks';
import WhyModBit from './components/WhyModBit';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();

  // If already logged in (org stored), go straight to dashboard
  useEffect(() => {
    const orgId = localStorage.getItem('organizationId');
    if (orgId) {
      router.replace('/playground');
    }
  }, [router]);

  return (
    <div className="relative bg-[#08080a] text-zinc-200 overflow-x-hidden">
      {/* Interactive Background Dotfield */}
      <Dotfield />

      {/* ── PAGE 1 : Hero ── full viewport */}
      <section className="relative min-h-screen flex flex-col">
        {/* Top Navbar */}
        <Navbar />

        {/* Hero Content — centred on remaining viewport */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pb-10">
          {/* Logo + Title */}
          <div className="flex flex-col items-center justify-center mb-8 group w-full">
            <div className="relative mb-5 sm:mb-6">
              <Image
                src="/modbit.webp"
                alt="ModBit Logo"
                width={120}
                height={120}
                priority
                className="relative w-18 sm:w-22 md:w-26 h-auto object-contain filter drop-shadow-[0_0_6px_rgba(255,255,255,0.08)] group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            {/* pl offset corrects optical centering with letter-spacing */}
            <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-[0.2em] sm:tracking-[0.25em] pl-[0.2em] sm:pl-[0.25em] text-zinc-100 uppercase cursor-blink text-center">
              ModBit
            </h1>
          </div>

          {/* SEO Headline */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl text-zinc-300 font-mono max-w-2xl mx-auto mb-4 tracking-wide leading-snug">
            Custom RAG-Powered AI Chatbots for Your Business
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-zinc-500 font-mono mb-0 tracking-wide">
            Trained on your data. Deployed in 3 steps.
          </p>

          {/* CTA Button Pair */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-14">
            <Link
              href="/login"
              className="inline-block px-10 py-4 modbit-btn-primary text-sm tracking-[0.2em] corner-border"
            >
              [ GET STARTED ]
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-10 py-4 modbit-btn-secondary text-sm tracking-[0.2em] corner-border"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
              KNOW THE STEPS
            </a>
          </div>
        </main>

        {/* Scroll arrow — fades out when user scrolls */}
        <div className="relative z-10 flex justify-center pb-8">
          <ScrollArrow />
        </div>
      </section>

      {/* ── PAGE 2 : How It Works ── full viewport */}
      <HowItWorks />

      {/* ── PAGE 3 : Why ModBit ── values & features */}
      <WhyModBit />

      {/* Minimal Clean Footer */}
      <footer className="relative z-10 border-t border-zinc-900 bg-[#08080a]/90 py-6 px-6 text-center text-xs text-zinc-500 font-mono tracking-widest">
        MODBIT &copy; 2026 // ALL RIGHTS RESERVED
      </footer>
    </div>
  );
}
