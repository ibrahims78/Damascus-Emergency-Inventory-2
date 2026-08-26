import { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
export function AppLayout({ title, active, children }: { title: string; active?: string; children: ReactNode }) { return <div dir="rtl" className="min-h-screen bg-[#eef5f6] text-[#0D2137] font-['Cairo'] flex"><Sidebar active={active}/><main className="flex-1 min-w-0"><Header title={title}/><div className="p-4 md:p-6 max-w-[1500px] mx-auto">{children}</div></main></div>; }