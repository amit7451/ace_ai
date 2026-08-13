'use client';

import { useState, useEffect, useRef } from 'react';

export const dynamic = 'force-dynamic';

export default function InstitutionDetailsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Institution Form State
  const [institutionName, setInstitutionName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportWebsite, setSupportWebsite] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [introductoryMessage, setIntroductoryMessage] = useState('');

  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const orgId = localStorage.getItem('organizationId');
      if (!orgId) return;

      const res = await fetch('http://localhost:3001/api/v1/configuration', {
        headers: { 'x-organization-id': orgId },
        credentials: 'include',
      });

      const data = await res.json();
      if (data.success && data.data) {
        const c = data.data;
        setInstitutionName(c.institutionName || '');
        setSupportEmail(c.supportEmail || '');
        setSupportWebsite(c.supportWebsite || '');
        setSupportPhone(c.supportPhone || '');
        setIntroductoryMessage(c.introductoryMessage || c.welcomeMessage || '');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load institution details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch('http://localhost:3001/api/v1/configuration', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': orgId || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          institutionName: institutionName || undefined,
          supportEmail: supportEmail || undefined,
          supportWebsite: supportWebsite || undefined,
          supportPhone: supportPhone || undefined,
          introductoryMessage: introductoryMessage || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(
          'Institution details saved and synced across widgets and endpoints successfully.'
        );
      } else {
        setError(data.error?.message || 'Failed to save institution details.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto font-mono text-xs text-zinc-500 animate-pulse">
        LOADING INSTITUTION DETAILS...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 font-mono text-zinc-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase">
            INSTITUTION DETAILS & SUPPORT CONTACT
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage your organization branding, support emails, contact websites, and custom chatbot
            greetings.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 border border-red-900/60 bg-red-950/30 text-red-400 text-xs">
          ! {error}
        </div>
      )}
      {success && (
        <div className="p-3 border border-emerald-800/80 bg-emerald-950/40 text-emerald-300 text-xs">
          ✓ {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Column */}
        <form
          onSubmit={handleSave}
          className="modbit-card p-6 border border-zinc-800 corner-border space-y-6"
        >
          <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider border-b border-zinc-800 pb-3 text-emerald-400">
            ORGANIZATION & SUPPORT PROFILE
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5 font-bold">
                Institution Name
              </label>
              <input
                type="text"
                placeholder="Stanford University"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950 border border-zinc-800 focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5 font-bold">
                Support Email
              </label>
              <input
                type="email"
                placeholder="support@institution.edu"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950 border border-zinc-800 focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5 font-bold">
                Support Website URL
              </label>
              <input
                type="url"
                placeholder="https://support.institution.edu"
                value={supportWebsite}
                onChange={(e) => setSupportWebsite(e.target.value)}
                className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950 border border-zinc-800 focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5 font-bold">
                Support Phone
              </label>
              <input
                type="text"
                placeholder="+1 (800) 555-0199"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950 border border-zinc-800 focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5 font-bold">
                Custom Chatbot Introductory Message
              </label>
              <textarea
                rows={3}
                placeholder="Welcome! How can we help you today?"
                value={introductoryMessage}
                onChange={(e) => setIntroductoryMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950 border border-zinc-800 focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end border-t border-zinc-800">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 modbit-btn-primary text-xs uppercase tracking-wider disabled:opacity-50 font-bold"
            >
              {saving ? '[ SAVING DETAILS... ]' : '[ SAVE INSTITUTION DETAILS ]'}
            </button>
          </div>
        </form>

        {/* Real-time Preview Column */}
        <div className="space-y-6">
          <div className="modbit-card p-6 border border-zinc-800 corner-border bg-zinc-950/60 space-y-4">
            <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider border-b border-zinc-800 pb-3">
              CHATBOT GREETING PREVIEW
            </h2>

            <p className="text-xs text-zinc-400 leading-relaxed">
              This preview illustrates how your custom introductory greeting message will appear to
              visitors when they launch the chatbot:
            </p>

            {/* Chatbot Greeting Card Preview */}
            <div className="p-4 border border-zinc-800 bg-zinc-900/80 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                <span>✦ CHATBOT WELCOME GREETING</span>
                <span className="text-zinc-500">LIVE PREVIEW</span>
              </div>
              <p className="text-xs text-zinc-200 italic">
                &quot;{introductoryMessage || 'Hi there! How can I help you today?'}&quot;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
