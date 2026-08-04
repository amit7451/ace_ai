'use client';

import { useEffect, useRef, useState } from 'react';

// ── Scroll arrow — hides once user scrolls past hero ─────────
function ScrollArrow() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > window.innerHeight * 0.3);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <a
      href="#how-it-works"
      aria-label="Scroll to How It Works"
      className="scroll-arrow-btn"
      style={{
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
        transition: 'opacity 0.4s ease',
      }}
    >
      {/* Outer ring */}
      <span className="scroll-arrow-ring" />
      {/* Chevron down */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="scroll-arrow-icon"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </a>
  );
}

export { ScrollArrow };

// ── Step data ─────────────────────────────────────────────────
const steps = [
  {
    number: '01',
    title: 'Create Your Organisation',
    subtitle: 'Sign up in seconds',
    description: 'Register your business and create a workspace. No credit card needed to start.',
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Connect Your AI Model',
    subtitle: 'Bring your own API key',
    description:
      'Plug in your API key — OpenAI, Gemini, Claude, or any supported model. You stay in control.',
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Upload & Go Live',
    subtitle: 'Your chatbot, trained on your data',
    description:
      "Upload your docs, PDFs, or knowledge base. We train the chatbot on it — and it's live. That's it.",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="16 16 12 12 8 16" />
        <line x1="12" y1="12" x2="12" y2="21" />
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      </svg>
    ),
  },
];

// ── Step card with scroll-triggered reveal ────────────────────
function StepCard({ step, index }: { step: (typeof steps)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="step-card"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.6s ease ${index * 0.14}s, transform 0.6s ease ${index * 0.14}s`,
      }}
    >
      <span className="step-bg-number">{step.number}</span>
      <div className="step-icon">{step.icon}</div>
      <div className="step-body">
        <p className="step-subtitle">{step.subtitle}</p>
        <h3 className="step-title">{step.title}</h3>
        <p className="step-desc">{step.description}</p>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────
export default function HowItWorks() {
  return (
    <section id="how-it-works" className="how-it-works-section">
      <div className="hiw-header">
        <h2 className="hiw-heading">
          3 Steps.
          <br />
          Your AI Chatbot, Live.
        </h2>
        <p className="hiw-subheading">No engineers needed. No weeks of setup.</p>
      </div>

      <div className="steps-grid">
        {steps.map((step, i) => (
          <StepCard key={step.number} step={step} index={i} />
        ))}
      </div>
    </section>
  );
}
