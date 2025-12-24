import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav, MobileHeader } from "@/components/layout/MobileNav";

export default function MainLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex min-h-dvh overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <MobileHeader />
                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
                    {children}
                </main>
                <MobileBottomNav />
            </div>
        </div>
    );
}
