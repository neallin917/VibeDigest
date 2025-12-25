import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav, MobileHeader } from "@/components/layout/MobileNav";

export default function MainLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex h-dvh overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <MobileHeader />
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                    {children}
                </main>
                <MobileBottomNav />
            </div>
        </div>
    );
}
