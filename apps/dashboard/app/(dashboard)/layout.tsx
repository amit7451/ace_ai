import Sidebar from '../components/Sidebar';
import RequireOrganization from '../components/RequireOrganization';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireOrganization>
      <div className="flex h-screen bg-[#08080a] text-zinc-200 w-full font-mono">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative bg-[#08080a]">{children}</main>
      </div>
    </RequireOrganization>
  );
}
