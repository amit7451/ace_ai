'use client';

import { useEffect, useRef, useState } from 'react';

const values = [
  {
    tag: '// ACCURACY',
    heading: 'High-Precision RAG\nOut of the Box',
    body: 'Building a good RAG pipeline takes weeks — chunking strategy, embedding tuning, retrieval scoring, re-ranking. We handle all of it. You get a chatbot that actually answers correctly, not one that hallucinates.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    tag: '// CONTROL',
    heading: 'Tune Every\nParameter',
    body: 'Temperature, top-k, score threshold, system prompt, max tokens — all configurable from your dashboard. You decide how your chatbot thinks, not us.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
  {
    tag: '// YOUR KEYS',
    heading: 'Bring Your Own\nAPI Key',
    body: 'OpenAI, Gemini, Claude, Mistral — connect any supported model with your own API key. You control the model, the billing, and the data. We never touch your quota.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
  {
    tag: '// SECURITY',
    heading: 'Encrypted Keys.\nZero Exposure.',
    body: 'Every API key is encrypted at rest before storage. Your credentials are never logged, never exposed in responses, and only decrypted at runtime in an isolated context.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    tag: '// KNOWLEDGE',
    heading: 'Upload Docs.\nCrawl Websites.',
    body: 'Add PDFs, text files, or point our crawler at any URL. It automatically scrapes, chunks, and indexes your content — configurable depth, page limits, and exclusion rules.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    tag: '// DEPLOY',
    heading: 'Embeddable Widget\nin One Line',
    body: 'Generate a chat widget and embed it on any website with a single script tag. Fully styled, mobile-ready, and tied to your knowledge base — no dev work needed.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    tag: '// VISIBILITY',
    heading: 'Full Audit Trail\nEvery Query',
    body: 'Every conversation is logged with timestamps, source documents, and retrieval scores. Know exactly what your chatbot said, when, and why — and catch issues before your users do.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    tag: '// TEAM',
    heading: 'Multi-Member\nOrganisations',
    body: 'Invite your team. Everyone works inside one shared organisation — same knowledge base, same chatbot, same settings. Role-based access keeps things tidy.',
    icon: (
      <svg
        width="22"
        height="22"
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
    tag: '// TESTING',
    heading: 'Live Playground\nBefore You Deploy',
    body: 'Chat with your bot in a live playground before it goes live. See retrieval scores, matched sources, and response metrics in real time — fix before your users notice.',
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
];

function ValueCard({ item, index }: { item: (typeof values)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="value-card"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.55s ease ${(index % 4) * 0.08}s, transform 0.55s ease ${(index % 4) * 0.08}s`,
      }}
    >
      <div className="value-top">
        <div className="value-icon">{item.icon}</div>
        <span className="value-tag">{item.tag}</span>
      </div>
      <h3 className="value-heading">
        {item.heading.split('\n').map((line, i) => (
          <span key={i}>
            {line}
            {i === 0 && <br />}
          </span>
        ))}
      </h3>
      <p className="value-body">{item.body}</p>
    </div>
  );
}

export default function WhyModBit() {
  return (
    <section id="why-modbit" className="why-section">
      <div className="why-header">
        <h2 className="why-heading">Why ModBit?</h2>
        <p className="why-sub">
          Building RAG from scratch takes weeks of engineering.
          <br />
          We compress that into minutes — without sacrificing precision.
        </p>
      </div>

      <div className="values-grid">
        {values.map((item, i) => (
          <ValueCard key={item.tag} item={item} index={i} />
        ))}
      </div>
    </section>
  );
}
