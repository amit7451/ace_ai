import Sidebar from '../components/Sidebar';
import RequireOrganization from '../components/RequireOrganization';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireOrganization>
      <div className="flex h-screen bg-gray-50 w-full">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative">{children}</main>
      </div>
    </RequireOrganization>
  );
}
