import { BarChart3, Bell, Box, Cpu, HeartPulse, LayoutDashboard, Package, Search, Settings, Shield, Users } from "lucide-react";

const items = [
  ["لوحة المعلومات", LayoutDashboard], ["إدارة المخزون", Package],
  ["الإحصائيات", BarChart3], ["البحث المتقدم", Search], ["المستخدمون", Users], ["الإعدادات", Settings],
] as const;
export function Sidebar({ active = "لوحة المعلومات" }: { active?: string }) {
  return <aside className="hidden md:flex w-64 shrink-0 min-h-screen bg-[#0D2137] text-slate-200 flex-col">
    <div className="p-5 border-b border-white/10 flex items-center gap-3">
      <img src="/__mockup/images/logo.jpeg" className="w-11 h-11 rounded-lg object-cover bg-white" alt="شعار المنظومة"/>
      <div><div className="font-bold text-white text-sm">منظومة الإسعاف</div><div className="text-[10px] text-teal-300">إدارة المستودعات</div></div>
    </div>
    <div className="p-4 text-[10px] tracking-widest text-slate-500">القائمة الرئيسية</div>
    <nav className="px-3 space-y-1 flex-1">
      {items.map(([label, Icon]) => <div key={label} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm cursor-pointer ${active===label ? "bg-[#0A8FA0] text-white shadow-lg shadow-teal-950/30" : "hover:bg-white/5"}`}><Icon size={18}/><span>{label}</span>{label==="إدارة المخزون"&&<span className="mr-auto text-[10px] text-teal-200">4</span>}</div>)}
      <div className="pt-3 mt-3 border-t border-white/10 text-sm flex items-center gap-3 px-3 py-3"><Bell size={18}/><span>الإشعارات</span><span className="mr-auto bg-amber-500 text-white rounded-full w-5 h-5 text-center text-[10px] leading-5">5</span></div>
    </nav>
    <div className="m-3 p-3 rounded-xl bg-white/5 text-xs text-slate-400"><div className="flex justify-between"><span>حالة النظام</span><span className="text-emerald-400">● متصل</span></div><div className="mt-2 h-1 rounded bg-white/10"><div className="h-1 w-[82%] bg-teal-400 rounded"/></div></div>
  </aside>;
}