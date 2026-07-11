import './globals.css';
import Sidebar from './components/Sidebar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ION AI Dashboard',
  description: 'Manage your ION AI chatbot platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative">{children}</main>
      </body>
    </html>
  );
}
