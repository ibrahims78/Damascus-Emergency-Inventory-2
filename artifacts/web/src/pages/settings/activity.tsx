import { useState, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGetCurrentUser, getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import {
  Settings2,
  KeyRound,
  Building2,
  Save,
  User as UserIcon,
  DatabaseBackup,
  Download,
  Ruler,
  Plus,
  X,
  CheckCircle2,
  Tag,
  Pencil,
  Trash2,
  FileSpreadsheet,
  Upload,
  Loader2,
  Activity,
  LogIn,
  LogOut as LogOutIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldCheck,
  Eye,
  EyeOff,
  UsersRound,
  ListChecks,
  Power,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { downloadFile } from '@/lib/file-download';
interface SystemSettings {
  id: number;
  orgName: string;
  orgSubtitle?: string | null;
  expiryAlertDays: number;
  unitsList?: string | null;
  technicalConditions?: string | null;
  returnConditions?: string | null;
  setupCompleted: boolean;
  updatedAt: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchSettings(): Promise<SystemSettings> {
  const res = await fetch('/api/settings', { credentials: 'include' });
  if (!res.ok) throw new Error('فشل جلب الإعدادات');
  return res.json() as Promise<SystemSettings>;
}

async function saveSettings(
  data: Partial<Pick<SystemSettings, 'orgName' | 'orgSubtitle' | 'expiryAlertDays' | 'unitsList' | 'technicalConditions' | 'returnConditions'>>,
): Promise<SystemSettings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'فشل حفظ الإعدادات');
  }
  return res.json() as Promise<SystemSettings>;
}

async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const res = await fetch('/api/settings/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'فشل تغيير كلمة المرور');
  }
}

const DEFAULT_UNITS = [
  'قطعة', 'علبة', 'لتر', 'مل', 'كيس', 'زجاجة', 'برميل',
  'رول', 'كرتون', 'طرد', 'حبة', 'زوج', 'مجموعة', 'جرام', 'كيلوغرام',
];

const DEFAULT_TECHNICAL_CONDITIONS = [
  { key: 'good', label: 'جيد' },
  { key: 'needs_inspection', label: 'يحتاج فحص' },
  { key: 'maintenance', label: 'تحت الصيانة' },
  { key: 'broken', label: 'معطل' },
  { key: 'consumed', label: 'مستهلك / متلف' },
];

const DEFAULT_RETURN_CONDITIONS = [
  { key: 'good', label: 'جيد', behavior: 'good' },
  { key: 'damaged', label: 'تالف', behavior: 'damaged' },
  { key: 'needs_maintenance', label: 'يحتاج صيانة', behavior: 'needs_maintenance' },
  { key: 'missing', label: 'مفقود', behavior: 'missing' },
];

// ─── Settings Page ────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'الآن';
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `منذ ${d} يوم`;
  return new Date(iso).toLocaleDateString('ar-SY', { day: 'numeric', month: 'short' });
}

export function ActivityTab() {
  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['my-activity'],
    queryFn: async () => {
      const res = await fetch('/api/settings/my-activity', { credentials: 'include' });
      if (!res.ok) throw new Error('فشل جلب السجل');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">آخر {entries.length} نشاطات</span>
        </div>
        <span className="text-xs text-muted-foreground">يتجدد تلقائياً</span>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-40" />
          جاري التحميل...
        </div>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm text-muted-foreground">لا توجد نشاطات مسجّلة بعد</p>
        </div>
      ) : (
        <div className="divide-y">
          {entries.map(entry => {
            const meta = ACT_META[entry.action];
            const entityAr = ENTITY_AR[entry.entityType] ?? entry.entityType;
            const detailText = entry.details
              ? (entry.details.username as string) ||
                (entry.details.fullName as string) ||
                (entry.details.name as string) ||
                (entry.entityId ? `#${entry.entityId}` : '')
              : '';
            return (
              <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                {/* Action badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${meta?.color ?? 'bg-muted text-muted-foreground'}`}>
                  {meta?.icon}
                  {meta?.label ?? entry.action}
                </span>
                {/* Entity */}
                <span className="text-sm text-muted-foreground shrink-0">{entityAr}</span>
                {/* Detail */}
                {detailText && (
                  <span className="text-sm font-medium truncate flex-1">{detailText}</span>
                )}
                <div className="flex-1" />
                {/* Time */}
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {timeAgo(entry.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Org Tab ──────────────────────────────────────────────────────────────────


interface AuditEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

const ACT_META: Record<string, { label: string; icon: ReactNode; color: string }> = {
  login:           { label: '╪»╪«┘ê┘ä ┘ä┘ä┘å╪╕╪º┘à',   icon: <LogIn className="w-3.5 h-3.5" />,              color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  logout:          { label: '╪«╪▒┘ê╪¼',           icon: <LogOutIcon className="w-3.5 h-3.5" />,         color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  create:          { label: '╪Ñ╪╢╪º┘ü╪⌐',          icon: <Plus className="w-3.5 h-3.5" />,               color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  update:          { label: '╪¬╪╣╪»┘è┘ä',          icon: <Pencil className="w-3.5 h-3.5" />,             color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  delete:          { label: '╪¡╪░┘ü',            icon: <Trash2 className="w-3.5 h-3.5" />,             color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  transaction_in:  { label: '╪Ñ╪»╪«╪º┘ä ┘à┘ê╪º╪»',    icon: <ArrowDownToLine className="w-3.5 h-3.5" />,    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  transaction_out: { label: '╪Ñ╪«╪▒╪º╪¼ ┘à┘ê╪º╪»',    icon: <ArrowUpFromLine className="w-3.5 h-3.5" />,    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
};

const ENTITY_AR: Record<string, string> = {
  item:        '┘à╪º╪»╪⌐',
  equipment:   '╪¬╪¼┘ç┘è╪▓╪⌐',
  transaction: '╪╣┘à┘ä┘è╪⌐',
  user:        '┘à╪│╪¬╪«╪»┘à',
  category:    '╪¬╪╡┘å┘è┘ü',
};


