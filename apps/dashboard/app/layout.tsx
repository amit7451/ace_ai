import './globals.css';
import type { Metadata } from 'next';
import { Space_Mono, Share_Tech_Mono } from 'next/font/google';
import { AuthProvider } from './context/AuthContext';

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
});

const shareTechMono = Share_Tech_Mono({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-share-tech',
});

export const metadata: Metadata = {
  title: 'ModBit // Modular Computing Protocol',
  description: 'ModBit next-generation modular computing & institutional protocol framework.',
  icons: {
    icon: '/modbit.webp',
    apple: '/modbit.webp',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${shareTechMono.variable}`}>
      <body className="min-h-screen bg-[#08080a] text-zinc-200 font-mono antialiased selection:bg-zinc-800 selection:text-zinc-100">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
