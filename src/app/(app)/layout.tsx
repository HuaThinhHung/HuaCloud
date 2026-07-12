import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-[220px]">
        {children}
      </div>
      <MobileNav />
    </div>
  );
}
