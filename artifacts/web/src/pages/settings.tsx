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

// ─── Types ───────────────────────────────────────────────────────────────────

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

export function SettingsPage() {
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">الإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-1">إعدادات المنظومة والملف الشخصي</p>
      </div>

      <Tabs defaultValue="profile" dir="rtl">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="profile" className="gap-2">
            <UserIcon className="h-4 w-4" />الملف الشخصي
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <KeyRound className="h-4 w-4" />كلمة المرور
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />سجل نشاطي
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="org" className="gap-2">
              <Building2 className="h-4 w-4" />إعدادات المنظومة
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="h-4 w-4" />التصنيفات
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="recipients" className="gap-2">
              <UsersRound className="h-4 w-4" />الجهات المستلمة
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="exit-reasons" className="gap-2">
              <ListChecks className="h-4 w-4" />أسباب الإخراج
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="units" className="gap-2">
              <Ruler className="h-4 w-4" />وحدات القياس
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="technical-conditions" className="gap-2">
              <Wrench className="h-4 w-4" />الحالات الفنية
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="backup" className="gap-2">
              <DatabaseBackup className="h-4 w-4" />النسخ الاحتياطي
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="import" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />استيراد مواد
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="import-equipment" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />استيراد تجهيزات
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab user={currentUser} />
        </TabsContent>

        <TabsContent value="password">
          <PasswordTab />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="org">
            <OrgTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="categories">
            <CategoriesTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="recipients">
            <RecipientsTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="exit-reasons">
            <ExitReasonsTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="units">
            <UnitsTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="technical-conditions">
            <TechnicalConditionsTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="backup">
            <BackupTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="import">
            <ImportTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="import-equipment">
            <ImportEquipmentTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  admin:             { label: 'مدير نظام',    color: 'text-primary',     bg: 'bg-primary' },
  warehouse_manager: { label: 'أمين مستودع', color: 'text-amber-600',    bg: 'bg-amber-500' },
  viewer:            { label: 'مراقب',        color: 'text-slate-500',    bg: 'bg-slate-400' },
};

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('');
}

function ProfileTab({
  user,
}: {
  user?: { id?: number; fullName?: string; username?: string; role?: string } | null;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    if (user?.fullName) setNameInput(user.fullName);
  }, [user?.fullName]);

  const updateMutation = useMutation({
    mutationFn: async (fullName: string) => {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fullName }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'فشل تحديث الاسم');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast.success('تم تحديث الاسم بنجاح');
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roleMeta = ROLE_META[user?.role ?? ''] ?? ROLE_META.viewer;

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow-md ${roleMeta.bg}`}>
            {getInitials(user?.fullName)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="h-9 text-lg font-semibold max-w-xs"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') updateMutation.mutate(nameInput.trim());
                    if (e.key === 'Escape') setEditing(false);
                  }}
                />
                <Button
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={() => updateMutation.mutate(nameInput.trim())}
                  disabled={updateMutation.isPending || !nameInput.trim()}
                >
                  <Save className="h-3.5 w-3.5" />
                  {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9"
                  onClick={() => { setEditing(false); setNameInput(user?.fullName ?? ''); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold truncate">{user?.fullName || '—'}</h2>
                <button
                  onClick={() => setEditing(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                  title="تعديل الاسم"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-sm text-muted-foreground font-mono">@{user?.username}</span>
              <Badge
                variant="secondary"
                className={`text-xs font-medium ${roleMeta.color}`}
              >
                <ShieldCheck className="h-3 w-3 mr-1" />
                {roleMeta.label}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Account details */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wider">
          تفاصيل الحساب
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">الاسم الكامل</Label>
            <p className="font-medium">{user?.fullName || '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">اسم المستخدم</Label>
            <p className="font-mono text-sm bg-muted/50 rounded px-2 py-1 inline-block">{user?.username || '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">مستوى الصلاحية</Label>
            <p className={`font-medium ${roleMeta.color}`}>{roleMeta.label}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground border-t pt-4 mt-4">
          يمكنك تعديل اسمك الكامل بالضغط على أيقونة القلم. لتغيير الدور أو اسم المستخدم تواصل مع مدير النظام.
        </p>
      </div>
    </div>
  );
}

// ─── Password strength ────────────────────────────────────────────────────────

function calcStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score: 1, label: 'ضعيفة جداً',  color: 'bg-destructive' };
  if (score === 2) return { score: 2, label: 'ضعيفة',       color: 'bg-orange-500' };
  if (score === 3) return { score: 3, label: 'متوسطة',      color: 'bg-amber-500'  };
  if (score === 4) return { score: 4, label: 'جيدة',        color: 'bg-blue-500'   };
  return              { score: 5, label: 'قوية جداً',   color: 'bg-green-500'  };
}

// ─── Password Tab ─────────────────────────────────────────────────────────────

function PasswordTab() {
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showCur, setShowCur]   = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showCnf, setShowCnf]   = useState(false);

  const strength = calcStrength(next);
  const mismatch = confirm.length > 0 && next !== confirm;

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور بنجاح');
      setCurrent(''); setNext(''); setConfirm('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!current || !next || !confirm) { toast.error('يرجى تعبئة جميع الحقول'); return; }
    if (
      next.length < 12 ||
      !/[A-Z]/.test(next) ||
      !/[a-z]/.test(next) ||
      !/[0-9]/.test(next) ||
      !/[^A-Za-z0-9]/.test(next)
    ) {
      toast.error('يجب أن تحتوي كلمة المرور على 12 حرفاً، وحرف كبير وصغير ورقم ورمز');
      return;
    }
    if (next !== confirm)  { toast.error('كلمتا المرور غير متطابقتين'); return; }
    mutation.mutate({ currentPassword: current, newPassword: next });
  };

  return (
    <div className="bg-card border rounded-xl p-6 space-y-5 max-w-sm">
      <div>
        <h2 className="font-semibold text-lg">تغيير كلمة المرور</h2>
        <p className="text-xs text-muted-foreground mt-0.5">12 حرفاً على الأقل، مع حرف كبير وصغير ورقم ورمز</p>
      </div>

      {/* Current password */}
      <div className="space-y-1.5">
        <Label htmlFor="cur">كلمة المرور الحالية</Label>
        <div className="relative">
          <Input
            id="cur"
            type={showCur ? 'text' : 'password'}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            className="pl-10"
          />
          <button
            type="button"
            onClick={() => setShowCur(v => !v)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* New password + strength */}
      <div className="space-y-1.5">
        <Label htmlFor="nxt">كلمة المرور الجديدة</Label>
        <div className="relative">
          <Input
            id="nxt"
            type={showNext ? 'text' : 'password'}
            value={next}
            onChange={e => setNext(e.target.value)}
            className="pl-10"
          />
          <button
            type="button"
            onClick={() => setShowNext(v => !v)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {/* Strength bar */}
        {next && (
          <div className="space-y-1 pt-0.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    i <= strength.score ? strength.color : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <p className={`text-xs font-medium transition-colors ${
              strength.score <= 2 ? 'text-destructive' :
              strength.score === 3 ? 'text-amber-600 dark:text-amber-400' :
              'text-green-600 dark:text-green-400'
            }`}>
              {strength.label}
              <span className="text-muted-foreground font-normal mr-1.5">
                — أضف {[
                  next.length < 12 && 'المزيد من الأحرف',
                  !/[A-Z]/.test(next) && 'حرف كبير',
                  !/[a-z]/.test(next) && 'حرف صغير',
                  !/[0-9]/.test(next) && 'رقم',
                  !/[^A-Za-z0-9]/.test(next) && 'رمز (!@#...)',
                ].filter(Boolean).join('، ')}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Confirm */}
      <div className="space-y-1.5">
        <Label htmlFor="cnf">تأكيد كلمة المرور</Label>
        <div className="relative">
          <Input
            id="cnf"
            type={showCnf ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className={`pl-10 ${mismatch ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
          <button
            type="button"
            onClick={() => setShowCnf(v => !v)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showCnf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {mismatch && (
          <p className="text-xs text-destructive">كلمتا المرور غير متطابقتين</p>
        )}
      </div>

      <Button
        onClick={handleSave}
        disabled={mutation.isPending || !current || !next || !confirm || mismatch || strength.score < 5}
        className="gap-2 w-full"
      >
        <Save className="h-4 w-4" />
        {mutation.isPending ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
      </Button>
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

interface AuditEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

const ACT_META: Record<string, { label: string; icon: ReactNode; color: string }> = {
  login:           { label: 'دخول للنظام',   icon: <LogIn className="w-3.5 h-3.5" />,              color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  logout:          { label: 'خروج',           icon: <LogOutIcon className="w-3.5 h-3.5" />,         color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  create:          { label: 'إضافة',          icon: <Plus className="w-3.5 h-3.5" />,               color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  update:          { label: 'تعديل',          icon: <Pencil className="w-3.5 h-3.5" />,             color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  delete:          { label: 'حذف',            icon: <Trash2 className="w-3.5 h-3.5" />,             color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  transaction_in:  { label: 'إدخال مواد',    icon: <ArrowDownToLine className="w-3.5 h-3.5" />,    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  transaction_out: { label: 'إخراج مواد',    icon: <ArrowUpFromLine className="w-3.5 h-3.5" />,    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
};

const ENTITY_AR: Record<string, string> = {
  item:        'مادة',
  equipment:   'تجهيزة',
  transaction: 'عملية',
  user:        'مستخدم',
  category:    'تصنيف',
};

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

function ActivityTab() {
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

function OrgTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const [orgName, setOrgName]         = useState('');
  const [orgSubtitle, setOrgSubtitle] = useState('');
  const [expiryAlertDays, setDays]    = useState('30');

  useEffect(() => {
    if (settings) {
      setOrgName(settings.orgName);
      setOrgSubtitle(settings.orgSubtitle ?? '');
      setDays(String(settings.expiryAlertDays));
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('تم حفظ الإعدادات');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="bg-card border rounded-lg p-6 space-y-5">
      <h2 className="font-semibold text-lg">إعدادات المنظومة</h2>

      <div className="space-y-1.5">
        <Label htmlFor="orgName">اسم المنظومة <span className="text-destructive">*</span></Label>
        <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)}
          placeholder="منظومة الاحالة و الاسعاف و الطوارئ - دمشق" />
        <p className="text-xs text-muted-foreground">يظهر في رأس سندات الإدخال والإخراج</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="orgSubtitle">العنوان الفرعي (اختياري)</Label>
        <Input id="orgSubtitle" value={orgSubtitle} onChange={(e) => setOrgSubtitle(e.target.value)}
          placeholder="مثال: مستودع مواد الإسعاف" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expiryDays">
          أيام التنبيه قبل انتهاء الصلاحية <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-center gap-3">
          <Input id="expiryDays" type="number" min={1} max={365} value={expiryAlertDays}
            onChange={(e) => setDays(e.target.value)} className="w-28" dir="ltr" />
          <span className="text-sm text-muted-foreground">يوماً</span>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => mutation.mutate({ orgName, orgSubtitle, expiryAlertDays: Number(expiryAlertDays) })}
          disabled={mutation.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {mutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </Button>
      </div>
    </div>
  );
}

// ─── Units Tab ────────────────────────────────────────────────────────────────

function UnitsTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS);
  const [newUnit, setNewUnit] = useState('');
  const [editUnit, setEditUnit] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    if (settings?.unitsList) {
      try {
        const parsed = JSON.parse(settings.unitsList);
        if (Array.isArray(parsed) && parsed.every((unit) => typeof unit === 'string')) {
          setUnits(parsed);
        }
      } catch { /* keep defaults */ }
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (u: string[]) => saveSettings({ unitsList: JSON.stringify(u) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const persistUnits = (nextUnits: string[], successMessage: string) => {
    mutation.mutate(nextUnits, {
      onSuccess: () => {
        setUnits(nextUnits);
        setEditUnit(null);
        setEditValue('');
        toast.success(successMessage);
      },
    });
  };

  const addUnit = () => {
    const trimmed = newUnit.trim();
    if (!trimmed) return;
    if (units.some((unit) => unit.localeCompare(trimmed, 'ar', { sensitivity: 'base' }) === 0)) {
      toast.error('الوحدة موجودة مسبقاً');
      return;
    }
    const updated = [...units, trimmed];
    setNewUnit('');
    persistUnits(updated, 'تمت إضافة وحدة القياس');
  };

  const removeUnit = (u: string) => {
    if (units.length <= 1) {
      toast.error('يجب الإبقاء على وحدة قياس واحدة على الأقل');
      return;
    }
    const updated = units.filter((x) => x !== u);
    persistUnits(updated, 'تم حذف وحدة القياس');
  };

  const startEdit = (unit: string) => {
    setEditUnit(unit);
    setEditValue(unit);
  };

  const saveEdit = () => {
    if (!editUnit) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast.error('اسم الوحدة مطلوب');
      return;
    }
    if (
      units.some(
        (unit) =>
          unit !== editUnit &&
          unit.localeCompare(trimmed, 'ar', { sensitivity: 'base' }) === 0,
      )
    ) {
      toast.error('الوحدة موجودة مسبقاً');
      return;
    }
    persistUnits(
      units.map((unit) => (unit === editUnit ? trimmed : unit)),
      'تم تعديل وحدة القياس',
    );
  };

  return (
    <div className="bg-card border rounded-lg p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-lg">وحدات القياس</h2>
        <p className="text-sm text-muted-foreground mt-1">
          الوحدات المتاحة عند إضافة مواد جديدة
        </p>
      </div>

      {/* Add new unit */}
      <div className="flex gap-2 max-w-sm">
        <Input
          placeholder="أضف وحدة جديدة..."
          value={newUnit}
          onChange={(e) => setNewUnit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addUnit()}
        />
        <Button onClick={addUnit} className="gap-2 flex-shrink-0">
          <Plus className="h-4 w-4" />
          إضافة
        </Button>
      </div>

      {/* Units list */}
      <div className="flex flex-wrap gap-2">
        {units.map((u) => (
          <span
            key={u}
            className="inline-flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2 py-1 rounded-full text-sm font-medium"
          >
            {editUnit === u ? (
              <>
                <Input
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') saveEdit();
                    if (event.key === 'Escape') {
                      setEditUnit(null);
                      setEditValue('');
                    }
                  }}
                  className="h-7 w-28 bg-background px-2 text-sm"
                  autoFocus
                  aria-label={`تعديل الوحدة ${u}`}
                />
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={mutation.isPending}
                  className="text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  title="حفظ تعديل الوحدة"
                  aria-label="حفظ تعديل الوحدة"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditUnit(null);
                    setEditValue('');
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="إلغاء تعديل الوحدة"
                  aria-label="إلغاء تعديل الوحدة"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span>{u}</span>
                <button
                  type="button"
                  onClick={() => startEdit(u)}
                  disabled={mutation.isPending}
                  className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  title={`تعديل ${u}`}
                  aria-label={`تعديل ${u}`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => removeUnit(u)}
                  disabled={mutation.isPending}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  title={`حذف ${u}`}
                  aria-label={`حذف ${u}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </span>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {units.length} وحدة مسجّلة — التغييرات تُحفظ فوراً، ولا يؤثر حذف/تعديل الخيار على المواد المحفوظة سابقاً
      </p>
    </div>
  );
}

// ─── Technical Conditions Tab ──────────────────────────────────────────────────

interface TechnicalCondition {
  key: string;
  label: string;
}

function TechnicalConditionsTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const [conditions, setConditions] = useState<TechnicalCondition[]>(DEFAULT_TECHNICAL_CONDITIONS);
  const [newLabel, setNewLabel] = useState('');
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [returnConditions, setReturnConditions] = useState(DEFAULT_RETURN_CONDITIONS);
  const [newReturnLabel, setNewReturnLabel] = useState('');
  const [newReturnBehavior, setNewReturnBehavior] = useState('damaged');
  const [editReturnKey, setEditReturnKey] = useState<string | null>(null);
  const [editReturnLabel, setEditReturnLabel] = useState('');
  const [editReturnBehavior, setEditReturnBehavior] = useState('damaged');

  useEffect(() => {
    if (settings?.technicalConditions) {
      try {
        const parsed = JSON.parse(settings.technicalConditions);
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (condition) =>
              condition &&
              typeof condition.key === 'string' &&
              typeof condition.label === 'string',
          )
        ) {
          setConditions(parsed);
        }
      } catch { /* keep defaults */ }
    }
    if (settings?.returnConditions) {
      try {
        const parsed = JSON.parse(settings.returnConditions);
        if (Array.isArray(parsed) && parsed.every((item) => item && typeof item.key === 'string' && typeof item.label === 'string' && typeof item.behavior === 'string')) {
          setReturnConditions(parsed);
        }
      } catch { /* keep defaults */ }
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (next: TechnicalCondition[]) =>
      saveSettings({ technicalConditions: JSON.stringify(next) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const returnMutation = useMutation({
    mutationFn: (next: typeof DEFAULT_RETURN_CONDITIONS) =>
      saveSettings({ returnConditions: JSON.stringify(next) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const persist = (next: TechnicalCondition[], message: string) => {
    mutation.mutate(next, {
      onSuccess: () => {
        setConditions(next);
        setEditKey(null);
        setEditValue('');
        toast.success(message);
      },
    });
  };

  const isDuplicate = (label: string, exceptKey?: string) =>
    conditions.some(
      (condition) =>
        condition.key !== exceptKey &&
        condition.label.localeCompare(label, 'ar', { sensitivity: 'base' }) === 0,
    );

  const addCondition = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (isDuplicate(label)) {
      toast.error('الحالة الفنية موجودة مسبقاً');
      return;
    }
    const key = `technical_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    persist([...conditions, { key, label }], 'تمت إضافة الحالة الفنية');
    setNewLabel('');
  };

  const saveEdit = () => {
    if (!editKey) return;
    const label = editValue.trim();
    if (!label) {
      toast.error('اسم الحالة الفنية مطلوب');
      return;
    }
    if (isDuplicate(label, editKey)) {
      toast.error('الحالة الفنية موجودة مسبقاً');
      return;
    }
    persist(
      conditions.map((condition) =>
        condition.key === editKey ? { ...condition, label } : condition,
      ),
      'تم تعديل الحالة الفنية',
    );
  };

  const removeCondition = (key: string) => {
    if (conditions.length <= 1) {
      toast.error('يجب الإبقاء على حالة فنية واحدة على الأقل');
      return;
    }
    persist(
      conditions.filter((condition) => condition.key !== key),
      'تم حذف الحالة الفنية',
    );
  };

  const saveReturnConditions = (next: typeof DEFAULT_RETURN_CONDITIONS, message: string) => {
    returnMutation.mutate(next, {
      onSuccess: () => {
        setReturnConditions(next);
        setEditReturnKey(null);
        toast.success(message);
      },
    });
  };
  const addReturnCondition = () => {
    const label = newReturnLabel.trim();
    if (!label || returnConditions.some((item) => item.label.localeCompare(label, 'ar', { sensitivity: 'base' }) === 0)) {
      toast.error(label ? 'حالة الإعادة موجودة مسبقاً' : 'اسم الحالة مطلوب');
      return;
    }
    const key = `return_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    saveReturnConditions([...returnConditions, { key, label, behavior: newReturnBehavior }], 'تمت إضافة حالة الإعادة');
    setNewReturnLabel('');
  };
  const saveReturnEdit = () => {
    if (!editReturnKey || !editReturnLabel.trim()) return;
    if (returnConditions.some((item) => item.key !== editReturnKey && item.label.localeCompare(editReturnLabel.trim(), 'ar', { sensitivity: 'base' }) === 0)) {
      toast.error('حالة الإعادة موجودة مسبقاً');
      return;
    }
    saveReturnConditions(
      returnConditions.map((item) => item.key === editReturnKey ? { ...item, label: editReturnLabel.trim(), behavior: editReturnBehavior } : item),
      'تم تعديل حالة الإعادة',
    );
  };

  return (
    <div className="bg-card border rounded-lg p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-lg">الحالات الفنية</h2>
        <p className="text-sm text-muted-foreground mt-1">
          الحالات المتاحة عند إضافة أو تعديل التجهيزات
        </p>
      </div>

      <div className="flex gap-2 max-w-xl">
        <Input
          placeholder="أضف حالة فنية جديدة..."
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && addCondition()}
        />
        <Button
          onClick={addCondition}
          disabled={!newLabel.trim() || mutation.isPending}
          className="gap-2 flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          إضافة
        </Button>
      </div>

      <div className="space-y-2">
        {conditions.map((condition) => (
          <div
            key={condition.key}
            className="flex items-center gap-2 rounded-md border bg-secondary/40 px-3 py-2"
          >
            {editKey === condition.key ? (
              <>
                <Input
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') saveEdit();
                    if (event.key === 'Escape') {
                      setEditKey(null);
                      setEditValue('');
                    }
                  }}
                  className="h-8 flex-1 bg-background"
                  autoFocus
                  aria-label={`تعديل الحالة ${condition.label}`}
                />
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={mutation.isPending}
                  className="text-primary hover:text-primary/80 disabled:opacity-50"
                  title="حفظ التعديل"
                  aria-label="حفظ التعديل"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditKey(null);
                    setEditValue('');
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  title="إلغاء التعديل"
                  aria-label="إلغاء التعديل"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 font-medium">{condition.label}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditKey(condition.key);
                    setEditValue(condition.label);
                  }}
                  disabled={mutation.isPending}
                  className="text-muted-foreground hover:text-primary disabled:opacity-50"
                  title={`تعديل ${condition.label}`}
                  aria-label={`تعديل ${condition.label}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeCondition(condition.key)}
                  disabled={mutation.isPending}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  title={`حذف ${condition.label}`}
                  aria-label={`حذف ${condition.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {conditions.length} حالات مسجّلة — تعديل الاسم يحدّث العرض، ولا يغيّر السجلات المحفوظة
      </p>

      <div className="border-t pt-6 space-y-4">
        <div>
          <h3 className="font-semibold">حالات الصنف عند الإعادة والمرتجع</h3>
          <p className="text-sm text-muted-foreground mt-1">
            هذه القائمة تظهر في خانتي «حالة الصنف عند الإعادة» و«حالة المرتجع». التأثير التشغيلي يحدد كيفية معالجة الرصيد.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label>اسم الحالة</Label>
            <Input value={newReturnLabel} onChange={(e) => setNewReturnLabel(e.target.value)} placeholder="مثال: يحتاج تنظيف" />
          </div>
          <div className="w-52 space-y-1">
            <Label>التأثير التشغيلي</Label>
            <Select value={newReturnBehavior} onValueChange={setNewReturnBehavior}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="good">جيد</SelectItem>
                <SelectItem value="damaged">تالف</SelectItem>
                <SelectItem value="needs_maintenance">يحتاج صيانة</SelectItem>
                <SelectItem value="missing">مفقود</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addReturnCondition} disabled={!newReturnLabel.trim() || returnMutation.isPending} className="gap-2"><Plus className="h-4 w-4" />إضافة</Button>
        </div>
        <div className="space-y-2">
          {returnConditions.map((item) => (
            <div key={item.key} className="flex flex-wrap items-center gap-2 rounded-md border bg-secondary/40 px-3 py-2">
              {editReturnKey === item.key ? (
                <>
                  <Input className="h-8 flex-1 min-w-[180px]" value={editReturnLabel} onChange={(e) => setEditReturnLabel(e.target.value)} />
                  <Select value={editReturnBehavior} onValueChange={setEditReturnBehavior}><SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="good">جيد</SelectItem><SelectItem value="damaged">تالف</SelectItem><SelectItem value="needs_maintenance">يحتاج صيانة</SelectItem><SelectItem value="missing">مفقود</SelectItem></SelectContent></Select>
                  <Button size="sm" onClick={saveReturnEdit} disabled={returnMutation.isPending}><Save className="h-3.5 w-3.5" />حفظ</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditReturnKey(null)}><X className="h-3.5 w-3.5" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium text-sm">{item.label}</span>
                  <Badge variant="outline">{item.behavior === 'good' ? 'جيد' : item.behavior === 'damaged' ? 'تالف' : item.behavior === 'needs_maintenance' ? 'يحتاج صيانة' : 'مفقود'}</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="تعديل" onClick={() => { setEditReturnKey(item.key); setEditReturnLabel(item.label); setEditReturnBehavior(item.behavior); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="حذف" disabled={returnConditions.length <= 1} onClick={() => saveReturnConditions(returnConditions.filter((entry) => entry.key !== item.key), 'تم حذف حالة الإعادة')}><Trash2 className="h-3.5 w-3.5" /></Button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Backup Tab ───────────────────────────────────────────────────────────────

function BackupTab() {
  const RESTORE_TIMEOUT_MS = 120_000;
  const [downloading, setDownloading] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreMode, setRestoreMode] = useState<'full' | 'merge'>('merge');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [packageBase64, setPackageBase64] = useState('');
  const [packageSummary, setPackageSummary] = useState<{
    manifest?: { packageType?: string; createdAt?: string; sourceNodeId?: string };
    recordCount?: number;
    changeCount?: number;
    entityTypes?: string[];
  } | null>(null);
  const [preview, setPreview] = useState<{
    token: string;
    report: {
      counts: Record<string, number>;
      records: Array<{ entityType: string; status: string; code?: string }>;
    };
    summary?: {
      manifest?: { packageType?: string; createdAt?: string; sourceNodeId?: string };
      recordCount?: number;
      changeCount?: number;
      entityTypes?: string[];
    };
  } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restorePointId, setRestorePointId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    applied: number;
    duplicate: number;
    conflict: number;
    skipped: number;
    restorePointId: string | null;
  } | null>(null);

  const { data: info, isLoading: infoLoading, refetch } = useQuery({
    queryKey: ['backup-info'],
    queryFn: async () => {
      const res = await fetch('/api/backup/info', { credentials: 'include' });
      if (!res.ok) throw new Error('فشل جلب معلومات قاعدة البيانات');
      return res.json() as Promise<Record<string, number>>;
    },
  });

  const handleExport = async () => {
    if (exportPassword.length < 8) {
      toast.error('أدخل كلمة مرور للحزمة من 8 أحرف على الأقل');
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch('/api/backups/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: exportPassword }),
      });
      if (!res.ok) throw new Error('فشل تصدير البيانات');
      const blob = await res.blob();
      const dateStr = new Date().toISOString().split('T')[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `damascus-${dateStr}.dme-sync`;
      a.click();
      URL.revokeObjectURL(url);
      setExportPassword('');
      toast.success('تم تصدير الحزمة المشفرة بنجاح');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setDownloading(false);
    }
  };

  const fileToBase64 = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('تعذر قراءة ملف النسخة'));
      reader.readAsDataURL(file);
    });
    const separator = dataUrl.indexOf(',');
    if (separator < 0) throw new Error('تعذر قراءة محتوى ملف النسخة');
    return dataUrl.slice(separator + 1);
  };

  const withRestoreTimeout = async <T,>(promise: Promise<T>) => {
    let timeoutId: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error('استغرق فحص الحزمة وقتاً أطول من المتوقع؛ تحقق من الملف وكلمة المرور ثم أعد المحاولة')),
        RESTORE_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  };

  const inspectAndPreview = async () => {
    if (!restoreFile) {
      toast.error('اختر ملف .dme-sync أولاً');
      return;
    }
    if (restorePassword.length < 8) {
      toast.error('أدخل كلمة مرور الحزمة');
      return;
    }
    setRestoring(true);
    setPreview(null);
    setRestoreError(null);
    setRestoreResult(null);
    try {
      const encoded = await fileToBase64(restoreFile);
      setPackageBase64(encoded);
      // Dry Run already returns the package summary. Avoid decrypting the same
      // large package twice; this is especially important in Android WebView.
      const previewResponse = await withRestoreTimeout(fetch('/api/backups/dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          packageBase64: encoded,
          password: restorePassword,
          mode: restoreMode,
        }),
      }));
      const previewData = (await previewResponse.json()) as typeof preview & { error?: string };
      if (!previewResponse.ok) throw new Error(previewData.error || 'تعذر تنفيذ المعاينة');
      setPackageSummary(previewData.summary ?? null);
      setPreview(previewData as NonNullable<typeof preview>);
      toast.success('تم الفحص والمعاينة؛ لا تزال الاستعادة بحاجة إلى تأكيد صريح');
    } catch (err) {
      setPackageBase64('');
      const message = err instanceof Error ? err.message : 'تعذر فحص الحزمة';
      setRestoreError(message);
      toast.error(message);
    } finally {
      setRestoring(false);
    }
  };

  const applyRestore = async () => {
    if (!preview || !packageBase64) return;
    if (!window.confirm('سيتم تطبيق الاستعادة بعد المعاينة. هل تريد المتابعة؟')) return;
    setRestoring(true);
    setRestoreError(null);
    setRestoreResult(null);
    try {
      const response = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          packageBase64,
          password: restorePassword,
          mode: restoreMode,
          previewToken: preview.token,
          confirm: true,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        restorePointId?: string;
        counts?: { applied?: number; duplicate?: number; conflict?: number; skipped?: number };
      };
      if (!response.ok) throw new Error(result.error || 'فشلت الاستعادة');
      setRestorePointId(result.restorePointId ?? null);
      setRestoreResult({
        applied: result.counts?.applied ?? 0,
        duplicate: result.counts?.duplicate ?? 0,
        conflict: result.counts?.conflict ?? 0,
        skipped: result.counts?.skipped ?? 0,
        restorePointId: result.restorePointId ?? null,
      });
      setPreview(null);
      setPackageBase64('');
      setRestoreFile(null);
      toast.success('تمت الاستعادة ذرياً وحُفظت نقطة تراجع تلقائية');
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشلت الاستعادة';
      setRestoreError(message);
      toast.error(message);
    } finally {
      setRestoring(false);
    }
  };

  const infoRows: [string, string][] = info
    ? [
        ['التصنيفات',        String(info.categories ?? 0)],
        ['المواد والمستهلكات', String(info.items ?? 0)],
        ['التجهيزات',         String(info.equipment ?? 0)],
        ['العمليات (إدخال/إخراج)', String(info.transactions ?? 0)],
        ['الجهات المستلمة',   String(info.recipients ?? 0)],
        ['المستخدمون',        String(info.users ?? 0)],
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Stats card */}
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-lg">محتويات قاعدة البيانات</h2>
        {infoLoading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {infoRows.map(([label, value]) => (
              <div key={label} className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{Number(value).toLocaleString('ar')}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export card */}
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg flex-shrink-0">
            <Download className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">تصدير نسخة احتياطية</h3>
            <p className="text-sm text-muted-foreground mt-1">
              تُصدَّر حزمة <code>.dme-sync</code> معيارية مضغوطة ومشفرة AES-256-GCM وتستبعد كلمات
              المرور والجلسات. احتفظ بكلمة المرور خارج ملف الحزمة.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="password"
            value={exportPassword}
            onChange={(event) => setExportPassword(event.target.value)}
            placeholder="كلمة مرور الحزمة (8 أحرف على الأقل)"
            aria-label="كلمة مرور تصدير الحزمة"
            className="sm:max-w-sm"
          />
          <Button onClick={handleExport} disabled={downloading} className="gap-2">
          <Download className="h-4 w-4" />
            {downloading ? 'جاري التصدير...' : 'تصدير حزمة مشفرة'}
          </Button>
        </div>
      </div>

      {/* Restore card */}
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg flex-shrink-0">
            <Upload className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold">فحص واستعادة حزمة</h3>
            <p className="text-sm text-muted-foreground mt-1">
              لا يمكن اعتماد الاستعادة مباشرة: ارفع الحزمة، أدخل كلمة المرور، نفّذ Dry Run، ثم راجع
              النتائج قبل التأكيد. النمط الكامل يستبدل بيانات المستودع بعد حفظ نقطة تراجع.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="file"
            accept=".dme-sync,application/octet-stream"
            onChange={(event) => {
              setRestoreFile(event.target.files?.[0] ?? null);
              setPackageSummary(null);
              setPreview(null);
              setRestoreError(null);
              setRestoreResult(null);
            }}
            aria-label="اختيار حزمة dme-sync"
          />
          <Input
            type="password"
            value={restorePassword}
            onChange={(event) => setRestorePassword(event.target.value)}
            placeholder="كلمة مرور الحزمة"
            aria-label="كلمة مرور الاستعادة"
          />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Select value={restoreMode} onValueChange={(value) => setRestoreMode(value as 'full' | 'merge')}>
            <SelectTrigger className="sm:w-56" aria-label="نمط الاستعادة">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="merge">دمج آمن — لا يحذف الحالي</SelectItem>
              <SelectItem value="full">استعادة كاملة — استبدال البيانات</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={inspectAndPreview} disabled={restoring} className="gap-2">
            {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {restoring ? 'جاري فك الحزمة وفحصها...' : 'فحص وتنفيذ Dry Run'}
          </Button>
        </div>
        {packageSummary && (
          <div className="rounded-lg bg-muted/40 border p-4 text-sm space-y-1">
            <p className="font-medium">ملخص الحزمة</p>
            <p>النوع: {packageSummary.manifest?.packageType ?? '—'} — السجلات: {packageSummary.recordCount ?? 0} — التغييرات: {packageSummary.changeCount ?? 0}</p>
            <p className="text-muted-foreground">العقدة المصدر: {packageSummary.manifest?.sourceNodeId ?? '—'}</p>
          </div>
        )}
        {preview && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
            <p className="font-medium">نتيجة المعاينة قبل التطبيق</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              {(['applied', 'duplicate', 'rejected', 'conflict', 'skipped'] as const).map((key) => (
                <div key={key} className="rounded bg-background border p-2">
                  <div className="font-bold text-base">{preview.report.counts[key] ?? 0}</div>
                  <div className="text-muted-foreground">{key}</div>
                </div>
              ))}
            </div>
            {preview.report.records.some((record) => record.status === 'rejected' || record.status === 'conflict') && (
              <p className="text-sm text-destructive">توجد سجلات مرفوضة أو متعارضة؛ لن يسمح الخادم بالتطبيق حتى تصحح الحزمة.</p>
            )}
            <Button onClick={applyRestore} disabled={restoring || (preview.report.counts.rejected ?? 0) > 0} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> تأكيد وتطبيق الاستعادة
            </Button>
          </div>
        )}
        {restoreError && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-medium">فشلت الاستعادة ولم تُحفظ التغييرات</p>
            <p className="mt-1">{restoreError}</p>
            <p className="mt-2 text-xs">نفّذ الفحص والمعاينة مرة أخرى قبل إعادة المحاولة.</p>
          </div>
        )}
        {restoreResult && (
          <div role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            <p className="font-medium">تمت الاستعادة بنجاح</p>
            <p className="mt-1">
              مطبّق: {restoreResult.applied} — مكرر: {restoreResult.duplicate} — متعارض: {restoreResult.conflict} — متجاوز: {restoreResult.skipped}
            </p>
          </div>
        )}
        {restorePointId && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            تم حفظ نقطة التراجع تلقائياً: <code>{restorePointId}</code>
          </p>
        )}
      </div>

      {/* Info card */}
      <div className="bg-muted/30 border border-dashed rounded-lg p-5 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm font-medium">توصيات النسخ الاحتياطي</p>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1.5 pr-6 list-disc">
          <li>قم بتصدير نسخة احتياطية أسبوعياً على الأقل</li>
          <li>احفظ الملف على قرص خارجي أو مشاركة شبكية</li>
           <li>اختبر الحزمة في بيئة اختبار قبل استخدامها على الإنتاج</li>
           <li>احتفظ بكلمة المرور في مدير أسرار منفصل، ولا ترسلها مع الملف</li>
           <li>كل استعادة تنشئ نقطة تراجع وتقريراً قابلاً للمراجعة</li>
        </ul>
      </div>

    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

interface Category {
  id: number;
  name: string;
  type: 'consumable' | 'equipment';
}

function CategoriesTab() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'consumable' | 'equipment'>('consumable');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'consumable' | 'equipment'>('consumable');

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories-settings'],
    queryFn: async () => {
      const res = await fetch('/api/categories', { credentials: 'include' });
      if (!res.ok) throw new Error('فشل جلب التصنيفات');
      return res.json();
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['categories-settings'] });
    qc.invalidateQueries({ queryKey: ['listCategories'] });
    qc.invalidateQueries({ queryKey: ['/api/categories'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; type: string }) => {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error || 'خطأ'); }
      return res.json();
    },
    onSuccess: () => { invalidate(); setNewName(''); toast.success('تم إضافة التصنيف'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, type }: { id: number; name: string; type: 'consumable' | 'equipment' }) => {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, type }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error || 'خطأ'); }
      return res.json();
    },
    onSuccess: () => { invalidate(); setEditId(null); toast.success('تم تعديل التصنيف'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error || 'خطأ'); }
    },
    onSuccess: () => { invalidate(); toast.success('تم حذف التصنيف'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const typeLabel = { consumable: 'مستهلكات', equipment: 'تجهيزات' };
  const consumable = categories.filter((c) => c.type === 'consumable');
  const equipment  = categories.filter((c) => c.type === 'equipment');

  return (
    <div className="space-y-6">
      {/* Add new */}
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-lg">إضافة تصنيف جديد</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5 flex-1 min-w-[180px]">
            <Label htmlFor="cat-name-s">اسم التصنيف</Label>
            <Input
              id="cat-name-s"
              placeholder="مثال: مستهلكات طبية، أدوية..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newName.trim() && createMutation.mutate({ name: newName.trim(), type: newType })}
            />
          </div>
          <div className="space-y-1.5 w-40">
            <Label>النوع</Label>
            <Select value={newType} onValueChange={(v) => setNewType(v as 'consumable' | 'equipment')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consumable">مستهلكات (مواد)</SelectItem>
                <SelectItem value="equipment">تجهيزات</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => newName.trim() && createMutation.mutate({ name: newName.trim(), type: newType })}
            disabled={!newName.trim() || createMutation.isPending}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            إضافة
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="bg-card border rounded-lg divide-y">
        <div className="px-5 py-3 bg-muted/40 flex items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            التصنيفات المسجّلة ({categories.length})
          </span>
        </div>

        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">جاري التحميل...</div>
        ) : categories.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            لا توجد تصنيفات بعد — أضف واحداً من الأعلى
          </div>
        ) : (
          [
            { label: 'مستهلكات (مواد)', items: consumable },
            { label: 'تجهيزات', items: equipment },
          ].map(({ label, items }) =>
            items.length === 0 ? null : (
              <div key={label}>
                <div className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20">
                  {label}
                </div>
                {items.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                    {editId === cat.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateMutation.mutate({ id: cat.id, name: editName, type: editType });
                            if (e.key === 'Escape') setEditId(null);
                          }}
                        />
                        <Select value={editType} onValueChange={(value) => setEditType(value as 'consumable' | 'equipment')}>
                          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consumable">مستهلكات (مواد)</SelectItem>
                            <SelectItem value="equipment">تجهيزات</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-8 gap-1" onClick={() => updateMutation.mutate({ id: cat.id, name: editName, type: editType })} disabled={updateMutation.isPending}>
                          <Save className="w-3.5 h-3.5" />حفظ
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 font-medium text-sm">{cat.name}</span>
                        <span className="text-xs text-muted-foreground">{typeLabel[cat.type]}</span>
                         <Button size="icon" variant="ghost" className="h-7 w-7" title="تعديل" onClick={() => { setEditId(cat.id); setEditName(cat.name); setEditType(cat.type); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="حذف"
                          onClick={() => {
                            if (confirm(`حذف تصنيف "${cat.name}"؟`)) deleteMutation.mutate(cat.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}

// ─── Recipient list tab ───────────────────────────────────────────────────────

interface ManagedRecipient {
  id: number;
  name: string;
  notes?: string | null;
  isActive: boolean;
}

function RecipientsTab() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const { data: recipients = [], isLoading } = useQuery<ManagedRecipient[]>({
    queryKey: ['recipients-settings'],
    queryFn: async () => {
      const res = await fetch('/api/recipients?includeInactive=true', { credentials: 'include' });
      if (!res.ok) throw new Error('فشل جلب الجهات المستلمة');
      return res.json();
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['recipients-settings'] });
    qc.invalidateQueries({ queryKey: ['listRecipients'] });
    qc.invalidateQueries({ queryKey: ['/api/recipients'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: number; name: string; notes?: string }) => {
      const res = await fetch(data.id ? `/api/recipients/${data.id}` : '/api/recipients', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: data.name.trim(), notes: data.notes?.trim() || null }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(error.error || 'فشل حفظ الجهة');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidate();
      if (variables.id) {
        setEditId(null);
        toast.success('تم تعديل الجهة المستلمة');
      } else {
        setNewName('');
        setNewNotes('');
        toast.success('تمت إضافة الجهة المستلمة');
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/recipients/${id}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(error.error || 'فشل تغيير حالة الجهة');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success('تم تحديث حالة الجهة');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-lg">إدارة الجهات المستلمة</h2>
          <p className="text-sm text-muted-foreground mt-1">
            هذه القائمة تظهر في نماذج إخراج المواد وتسليم العهد. التعطيل يحافظ على السجلات السابقة ولا يحذفها.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label htmlFor="recipient-name">اسم الجهة *</Label>
            <Input
              id="recipient-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && newName.trim()) {
                  saveMutation.mutate({ name: newName, notes: newNotes });
                }
              }}
              placeholder="مثال: نقطة إسعاف المزة"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipient-notes">ملاحظات (اختياري)</Label>
            <Input id="recipient-notes" value={newNotes} onChange={(event) => setNewNotes(event.target.value)} />
          </div>
          <Button
            onClick={() => newName.trim() && saveMutation.mutate({ name: newName, notes: newNotes })}
            disabled={!newName.trim() || saveMutation.isPending}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />إضافة
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg divide-y">
        <div className="px-5 py-3 bg-muted/40 flex items-center gap-2">
          <UsersRound className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">الجهات المسجّلة ({recipients.length})</span>
        </div>
        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">جاري التحميل...</div>
        ) : recipients.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد جهات بعد</div>
        ) : recipients.map((recipient) => (
          <div key={recipient.id} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
            {editId === recipient.id ? (
              <div className="grid flex-1 min-w-[260px] gap-2 md:grid-cols-2">
                <Input value={editName} onChange={(event) => setEditName(event.target.value)} autoFocus />
                <Input value={editNotes} onChange={(event) => setEditNotes(event.target.value)} placeholder="ملاحظات" />
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <p className={`font-medium text-sm ${!recipient.isActive ? 'text-muted-foreground line-through' : ''}`}>
                  {recipient.name}
                </p>
                {recipient.notes && <p className="text-xs text-muted-foreground mt-0.5">{recipient.notes}</p>}
              </div>
            )}
            <Badge variant={recipient.isActive ? 'secondary' : 'outline'} className="shrink-0">
              {recipient.isActive ? 'نشطة' : 'معطّلة'}
            </Badge>
            {editId === recipient.id ? (
              <>
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => editName.trim() && saveMutation.mutate({ id: recipient.id, name: editName, notes: editNotes })}
                  disabled={!editName.trim() || saveMutation.isPending}
                >
                  <Save className="w-3.5 h-3.5" />حفظ
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditId(null)}>إلغاء</Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="تعديل الجهة"
                  onClick={() => { setEditId(recipient.id); setEditName(recipient.name); setEditNotes(recipient.notes ?? ''); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1"
                  onClick={() => toggleMutation.mutate(recipient.id)}
                  disabled={toggleMutation.isPending}
                >
                  <Power className="w-3.5 h-3.5" />{recipient.isActive ? 'تعطيل' : 'تفعيل'}
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Exit reason list tab ──────────────────────────────────────────────────────

interface ManagedExitReason {
  id: number;
  name: string;
  isSystem: boolean;
  isActive: boolean;
}

function ExitReasonsTab() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const { data: reasons = [], isLoading } = useQuery<ManagedExitReason[]>({
    queryKey: ['exit-reasons-settings'],
    queryFn: async () => {
      const res = await fetch('/api/exit-reasons?includeInactive=true', { credentials: 'include' });
      if (!res.ok) throw new Error('فشل جلب أسباب الإخراج');
      return res.json();
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['exit-reasons-settings'] });
    qc.invalidateQueries({ queryKey: ['listExitReasons'] });
    qc.invalidateQueries({ queryKey: ['/api/exit-reasons'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: number; name: string }) => {
      const res = await fetch(data.id ? `/api/exit-reasons/${data.id}` : '/api/exit-reasons', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: data.name.trim() }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(error.error || 'فشل حفظ سبب الإخراج');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidate();
      if (variables.id) {
        setEditId(null);
        toast.success('تم تعديل سبب الإخراج');
      } else {
        setNewName('');
        toast.success('تمت إضافة سبب الإخراج');
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/exit-reasons/${id}/toggle`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(error.error || 'فشل تغيير حالة السبب');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success('تم تحديث حالة سبب الإخراج');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-lg">إدارة أسباب الإخراج</h2>
          <p className="text-sm text-muted-foreground mt-1">
            الأسباب النشطة فقط تظهر في نموذج إخراج المواد. الأسباب الافتراضية محمية لضمان سلامة التقارير والسجلات.
          </p>
        </div>
        <div className="flex gap-3 items-end max-w-xl">
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="exit-reason-name">اسم السبب *</Label>
            <Input
              id="exit-reason-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && newName.trim() && saveMutation.mutate({ name: newName })}
              placeholder="مثال: صرف لمهمة ميدانية"
            />
          </div>
          <Button onClick={() => newName.trim() && saveMutation.mutate({ name: newName })} disabled={!newName.trim() || saveMutation.isPending} className="gap-2">
            <Plus className="h-4 w-4" />إضافة
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg divide-y">
        <div className="px-5 py-3 bg-muted/40 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">الأسباب المسجّلة ({reasons.length})</span>
        </div>
        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">جاري التحميل...</div>
        ) : reasons.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد أسباب بعد</div>
        ) : reasons.map((reason) => (
          <div key={reason.id} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
            {editId === reason.id ? (
              <Input
                className="flex-1 min-w-[220px]"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                autoFocus
              />
            ) : (
              <span className={`flex-1 min-w-[220px] font-medium text-sm ${!reason.isActive ? 'text-muted-foreground line-through' : ''}`}>
                {reason.name}
              </span>
            )}
            {reason.isSystem && <Badge variant="outline">افتراضي محمي</Badge>}
            <Badge variant={reason.isActive ? 'secondary' : 'outline'}>{reason.isActive ? 'نشط' : 'معطّل'}</Badge>
            {editId === reason.id ? (
              <>
                <Button size="sm" className="h-8 gap-1" onClick={() => editName.trim() && saveMutation.mutate({ id: reason.id, name: editName })} disabled={!editName.trim() || saveMutation.isPending}>
                  <Save className="w-3.5 h-3.5" />حفظ
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditId(null)}>إلغاء</Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title={reason.isSystem ? 'السبب الافتراضي محمي' : 'تعديل السبب'}
                  disabled={reason.isSystem}
                  onClick={() => { setEditId(reason.id); setEditName(reason.name); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1"
                  disabled={reason.isSystem || toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate(reason.id)}
                >
                  <Power className="w-3.5 h-3.5" />{reason.isActive ? 'تعطيل' : 'تفعيل'}
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

interface ImportRow {
  [key: string]: string | number | undefined;
}

interface ImportResult {
  created: number;
  updated?: number;
  errors: { row: number; name: string; error: string }[];
}

function ImportTab() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState('');
  const [importMode, setImportMode] = useState<'insert' | 'upsert'>('insert');
  const queryClient = useQueryClient();

  const { data: categoriesData } = useQuery<{ id: number; name: string; type: string }[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories', { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      return res.json() as Promise<{ id: number; name: string; type: string }[]>;
    },
  });

  const categories = categoriesData ?? [];

  const handleExportTemplate = async () => {
    const XLSX = await import('xlsx');

    // Sheet 1: Data headers only — user fills in
    const dataHeaders = [
      'الرمز', 'الاسم *', 'الوحدة *', 'التصنيف',
      'الكمية الحالية', 'الحد الأدنى',
      'تاريخ الانتهاء', 'رقم الدفعة', 'الموقع', 'المورد', 'ملاحظات',
    ];
    const dataWs = XLSX.utils.aoa_to_sheet([dataHeaders]);
    dataWs['!cols'] = [
      { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 22 },
      { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 16 }, { wch: 22 }, { wch: 26 },
    ];

    // Sheet 2: Instructions
    const catList = categories.length
      ? categories.map((c) => c.name).join(' — ')
      : 'أضف التصنيفات أولاً من تبويب التصنيفات';
    const instrRows = [
      ['تعليمات الاستخدام — نموذج استيراد المواد'],
      [],
      ['العمود', 'الوصف', 'مطلوب؟', 'ملاحظات'],
      ['الرمز', 'رمز أو كود المادة', 'لا', 'يجب أن يكون فريداً إذا أُدخل'],
      ['الاسم *', 'اسم المادة', 'نعم', ''],
      ['الوحدة *', 'وحدة القياس (مثال: قطعة، رول، لتر)', 'نعم', ''],
      ['التصنيف', 'اسم التصنيف كما هو في النظام', 'لا', catList],
      ['الكمية الحالية', 'الكمية المتوفرة حالياً', 'لا', 'رقم صحيح ≥ 0 — افتراضي: 0'],
      ['الحد الأدنى', 'الحد الأدنى لإطلاق تنبيه النقص', 'لا', 'رقم صحيح ≥ 0 — افتراضي: 0'],
      ['تاريخ الانتهاء', 'تاريخ انتهاء الصلاحية', 'لا', 'الصيغة: YYYY-MM-DD مثال: 2026-12-31'],
      ['رقم الدفعة', 'رقم دفعة الإنتاج', 'لا', ''],
      ['الموقع', 'موقع التخزين داخل المستودع', 'لا', ''],
      ['المورد', 'اسم المورد أو الشركة', 'لا', ''],
      ['ملاحظات', 'أي ملاحظات إضافية', 'لا', ''],
      [],
      ['مثال على صف بيانات:'],
      ['MED-001', 'شاش طبي معقم', 'رول', categories[0]?.name ?? '', '50', '10', '2026-12-31', 'B-2024', 'رف A3', 'شركة الأدوية الوطنية', ''],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet(instrRows);
    instrWs['!cols'] = [
      { wch: 20 }, { wch: 36 }, { wch: 10 }, { wch: 55 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, dataWs, 'البيانات');
    XLSX.utils.book_append_sheet(wb, instrWs, 'التعليمات');
    const workbookBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await downloadFile(
      new Blob([workbookBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'نموذج_استيراد_المواد.xlsx',
    );
    toast.success('تم تحميل النموذج بنجاح');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setResult(null);
    setFileName(file.name);
    setRows([]);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });

      // Prefer "البيانات" sheet, otherwise first sheet
      const sheetName = wb.SheetNames.includes('البيانات')
        ? 'البيانات'
        : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: '' });

      if (data.length === 0) {
        setParseError('لم يتم العثور على بيانات في الملف — تأكد من تعبئة ورقة "البيانات"');
        return;
      }
      setRows(data);
    } catch {
      setParseError('فشل قراءة الملف — تأكد أنه ملف Excel صالح (.xlsx أو .xls)');
    }
    e.target.value = '';
  };

  const getName = (r: ImportRow) =>
    String(r['الاسم *'] ?? r['الاسم'] ?? '').trim();
  const getUnit = (r: ImportRow) =>
    String(r['الوحدة *'] ?? r['الوحدة'] ?? '').trim();

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setResult(null);

    const payload = rows.map((r) => ({
      code: String(r['الرمز'] ?? '').trim() || null,
      name: getName(r),
      unit: getUnit(r),
      categoryName: String(r['التصنيف'] ?? '').trim() || null,
      currentStock: r['الكمية الحالية'] ?? 0,
      minStock: r['الحد الأدنى'] ?? 0,
      expiryDate: String(r['تاريخ الانتهاء'] ?? '').trim() || null,
      batchNumber: String(r['رقم الدفعة'] ?? '').trim() || null,
      location: String(r['الموقع'] ?? '').trim() || null,
      supplier: String(r['المورد'] ?? '').trim() || null,
      notes: String(r['ملاحظات'] ?? '').trim() || null,
    }));

    try {
      const res = await fetch(`/api/items/bulk-import?mode=${importMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ImportResult;
      setResult(data);
      const total = data.created + (data.updated ?? 0);
      if (total > 0) {
        const parts: string[] = [];
        if (data.created > 0) parts.push(`إضافة ${data.created}`);
        if ((data.updated ?? 0) > 0) parts.push(`تحديث ${data.updated}`);
        toast.success(`تم ${parts.join(' و')} مادة بنجاح`);
        void queryClient.invalidateQueries({ queryKey: ['items'] });
        setRows([]);
        setFileName('');
      } else {
        toast.error('لم يتم استيراد أي مادة — راجع الأخطاء أدناه');
      }
    } catch {
      toast.error('حدث خطأ أثناء الاستيراد');
    } finally {
      setImporting(false);
    }
  };

  const previewCols: { label: string; get: (r: ImportRow) => string }[] = [
    { label: 'الاسم', get: (r) => getName(r) || '—' },
    { label: 'الوحدة', get: (r) => getUnit(r) || '—' },
    { label: 'التصنيف', get: (r) => String(r['التصنيف'] ?? '') || '—' },
    { label: 'الكمية', get: (r) => String(r['الكمية الحالية'] ?? 0) },
    { label: 'الحد الأدنى', get: (r) => String(r['الحد الأدنى'] ?? 0) },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">استيراد المواد من Excel</h3>
        <p className="text-sm text-muted-foreground mt-1">
          حمّل النموذج الفارغ، أدخل بيانات المواد، ثم استوردها للنظام دفعةً واحدة.
        </p>
      </div>

      {/* Step 1 — Download template */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">١</span>
          <span className="font-medium text-sm">حمّل النموذج الفارغ</span>
        </div>
        <p className="text-xs text-muted-foreground">
          ملف Excel جاهز بأعمدة المواد وورقة تعليمات مفصّلة.
          الحقلان المطلوبان هما <strong>الاسم</strong> و<strong>الوحدة</strong> فقط.
        </p>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void handleExportTemplate()}>
          <Download className="h-4 w-4" />
          تحميل نموذج Excel
        </Button>
      </div>

      {/* Step 2 — Upload file */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">٢</span>
          <span className="font-medium text-sm">ارفع الملف المعبأ</span>
        </div>
        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
          <div className="flex flex-col items-center gap-1 pointer-events-none">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {fileName ? fileName : 'اضغط لاختيار ملف Excel'}
            </span>
            {!fileName && <span className="text-xs text-muted-foreground">.xlsx أو .xls</span>}
          </div>
          <input
            type="file"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={(e) => void handleFileChange(e)}
          />
        </label>
        {parseError && <p className="text-sm text-destructive">{parseError}</p>}
        {rows.length > 0 && (
          <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            تم قراءة <strong>{rows.length}</strong> صف من الملف
          </p>
        )}
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
            <span className="text-sm font-medium">معاينة البيانات</span>
            <span className="text-xs text-muted-foreground">
              {rows.length > 5 ? `أول 5 صفوف من ${rows.length}` : `${rows.length} صف`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20">
                  {previewCols.map((c) => (
                    <th key={c.label} className="px-3 py-2 text-right font-medium text-muted-foreground">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                    {previewCols.map((c) => (
                      <td key={c.label} className="px-3 py-2">{c.get(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3 — Mode + Import */}
      {rows.length > 0 && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">٣</span>
            <span className="font-medium text-sm">اختر الوضع وابدأ الاستيراد</span>
          </div>

          {/* Mode toggle */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">وضع الاستيراد</p>
            <div className="inline-flex rounded-lg border bg-muted p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setImportMode('insert')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  importMode === 'insert'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                إضافة فقط
              </button>
              <button
                type="button"
                onClick={() => setImportMode('upsert')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  importMode === 'upsert'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                تحديث وإضافة
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {importMode === 'insert'
                ? 'المواد بنفس الرمز ستُرفض — مناسب للاستيراد الأوّلي.'
                : 'المواد بنفس الرمز ستُحدَّث بالكامل — المواد الجديدة ستُضاف تلقائياً.'}
            </p>
          </div>

          <Button onClick={() => void handleImport()} disabled={importing} className="gap-2">
            {importing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileSpreadsheet className="h-4 w-4" />}
            {importing ? 'جارٍ الاستيراد…' : `${importMode === 'upsert' ? 'تحديث/إضافة' : 'استيراد'} ${rows.length} مادة`}
          </Button>
        </div>
      )}

      {/* Results */}
      {result && (() => {
        const total = result.created + (result.updated ?? 0);
        const hasSuccess = total > 0;
        const summaryParts: string[] = [];
        if (result.created > 0) summaryParts.push(`إضافة ${result.created} مادة`);
        if ((result.updated ?? 0) > 0) summaryParts.push(`تحديث ${result.updated} مادة`);
        return (
          <div className={`rounded-lg border p-4 space-y-2 ${
            hasSuccess
              ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900'
              : 'border-destructive/30 bg-destructive/5'
          }`}>
            <div className="flex items-center gap-2">
              {hasSuccess
                ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                : <X className="h-5 w-5 text-destructive" />}
              <span className="font-medium text-sm">
                {hasSuccess
                  ? `تم ${summaryParts.join(' و')} بنجاح`
                  : 'لم يتم استيراد أي مادة'}
              </span>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  الأخطاء ({result.errors.length} صف):
                </p>
                <div className="max-h-36 overflow-y-auto space-y-0.5 rounded border bg-background p-2">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">
                      صف {e.row}: <span className="font-medium">{e.name}</span> — {e.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Equipment Import Tab ────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  good: 'جيدة',
  maintenance: 'في الصيانة',
  broken: 'معطلة',
  consumed: 'مستهلكة',
  needs_inspection: 'تحتاج فحص',
};

function ImportEquipmentTab() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState('');
  const [importMode, setImportMode] = useState<'insert' | 'upsert'>('insert');
  const queryClient = useQueryClient();

  const handleExportTemplate = async () => {
    const XLSX = await import('xlsx');

    // Sheet 1: Data headers
    const dataHeaders = [
      'الاسم *', 'نوع التجهيز', 'الموديل', 'الرقم التسلسلي',
      'الحالة', 'الكمية', 'الحد الأدنى للكمية',
      'سنة الصنع', 'بلد المنشأ', 'الحائز الحالي', 'ملاحظات',
    ];
    const dataWs = XLSX.utils.aoa_to_sheet([dataHeaders]);
    dataWs['!cols'] = [
      { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 22 },
      { wch: 18 }, { wch: 12 }, { wch: 20 },
      { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 30 },
    ];

    // Sheet 2: Instructions
    const conditionOptions = Object.entries(CONDITION_LABELS)
      .map(([, ar]) => ar)
      .join(' — ');
    const instrRows = [
      ['تعليمات الاستخدام — نموذج استيراد التجهيزات'],
      [],
      ['العمود', 'الوصف', 'مطلوب؟', 'ملاحظات'],
      ['الاسم *', 'اسم التجهيز أو الجهاز', 'نعم', ''],
      ['نوع التجهيز', 'تصنيف التجهيز (مثال: جهاز طبي، أثاث)', 'لا', ''],
      ['الموديل', 'رقم الموديل أو الطراز', 'لا', ''],
      ['الرقم التسلسلي', 'الرقم التسلسلي الفريد للجهاز', 'لا', 'يجب أن يكون فريداً إذا أُدخل'],
      ['الحالة', 'حالة التجهيز', 'لا', `القيم المقبولة: ${conditionOptions} — أو: good, maintenance, broken, consumed, needs_inspection — افتراضي: جيدة`],
      ['الكمية', 'عدد القطع المتوفرة', 'لا', 'رقم صحيح ≥ 1 — افتراضي: 1'],
      ['الحد الأدنى للكمية', 'الحد الأدنى لإطلاق تنبيه النقص', 'لا', 'رقم صحيح ≥ 0 — افتراضي: 0 (لا تنبيه)'],
      ['سنة الصنع', 'السنة الميلادية للتصنيع', 'لا', 'رقم بين 1900 و2100'],
      ['بلد المنشأ', 'بلد التصنيع', 'لا', ''],
      ['الحائز الحالي', 'اسم القسم أو الشخص المسؤول', 'لا', ''],
      ['ملاحظات', 'أي ملاحظات إضافية', 'لا', ''],
      [],
      ['مثال على صف بيانات:'],
      ['جهاز قياس ضغط الدم الرقمي', 'جهاز طبي', 'BPM-2000', 'SN-2024-001', 'جيدة', 3, 2, 2022, 'ألمانيا', 'قسم الإسعاف', 'شاشة LCD'],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet(instrRows);
    instrWs['!cols'] = [
      { wch: 22 }, { wch: 36 }, { wch: 10 }, { wch: 65 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, dataWs, 'البيانات');
    XLSX.utils.book_append_sheet(wb, instrWs, 'التعليمات');
    const workbookBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await downloadFile(
      new Blob([workbookBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'نموذج_استيراد_التجهيزات.xlsx',
    );
    toast.success('تم تحميل النموذج بنجاح');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setResult(null);
    setFileName(file.name);
    setRows([]);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      const sheetName = wb.SheetNames.includes('البيانات')
        ? 'البيانات'
        : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: '' });

      if (data.length === 0) {
        setParseError('لم يتم العثور على بيانات في الملف — تأكد من تعبئة ورقة "البيانات"');
        return;
      }
      setRows(data);
    } catch {
      setParseError('فشل قراءة الملف — تأكد أنه ملف Excel صالح (.xlsx أو .xls)');
    }
    e.target.value = '';
  };

  const getName = (r: ImportRow) =>
    String(r['الاسم *'] ?? r['الاسم'] ?? '').trim();

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setResult(null);

    const payload = rows.map((r) => ({
      name: getName(r),
      equipmentType: String(r['نوع التجهيز'] ?? '').trim() || null,
      model: String(r['الموديل'] ?? '').trim() || null,
      serialNumber: String(r['الرقم التسلسلي'] ?? '').trim() || null,
      condition: String(r['الحالة'] ?? '').trim() || null,
      quantity: r['الكمية'] ? Number(r['الكمية']) : 1,
      minQuantity: r['الحد الأدنى للكمية'] ? Number(r['الحد الأدنى للكمية']) : 0,
      manufactureYear: r['سنة الصنع'] ? Number(r['سنة الصنع']) : null,
      originCountry: String(r['بلد المنشأ'] ?? '').trim() || null,
      currentHolder: String(r['الحائز الحالي'] ?? '').trim() || null,
      notes: String(r['ملاحظات'] ?? '').trim() || null,
    }));

    try {
      const res = await fetch(`/api/equipment/bulk-import?mode=${importMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ImportResult;
      setResult(data);
      const total = data.created + (data.updated ?? 0);
      if (total > 0) {
        const parts: string[] = [];
        if (data.created > 0) parts.push(`إضافة ${data.created}`);
        if ((data.updated ?? 0) > 0) parts.push(`تحديث ${data.updated}`);
        toast.success(`تم ${parts.join(' و')} تجهيز بنجاح`);
        void queryClient.invalidateQueries({ queryKey: ['equipment'] });
        setRows([]);
        setFileName('');
      } else {
        toast.error('لم يتم استيراد أي تجهيز — راجع الأخطاء أدناه');
      }
    } catch {
      toast.error('حدث خطأ أثناء الاستيراد');
    } finally {
      setImporting(false);
    }
  };

  const previewCols: { label: string; get: (r: ImportRow) => string }[] = [
    { label: 'الاسم', get: (r) => getName(r) || '—' },
    { label: 'نوع التجهيز', get: (r) => String(r['نوع التجهيز'] ?? '') || '—' },
    { label: 'الموديل', get: (r) => String(r['الموديل'] ?? '') || '—' },
    { label: 'الحالة', get: (r) => String(r['الحالة'] ?? '') || '—' },
    { label: 'الرقم التسلسلي', get: (r) => String(r['الرقم التسلسلي'] ?? '') || '—' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">استيراد التجهيزات من Excel</h3>
        <p className="text-sm text-muted-foreground mt-1">
          حمّل النموذج الفارغ، أدخل بيانات التجهيزات، ثم استوردها للنظام دفعةً واحدة.
        </p>
      </div>

      {/* Step 1 — Download template */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">١</span>
          <span className="font-medium text-sm">حمّل النموذج الفارغ</span>
        </div>
        <p className="text-xs text-muted-foreground">
          ملف Excel جاهز بأعمدة التجهيزات وورقة تعليمات مفصّلة.
          الحقل الوحيد المطلوب هو <strong>الاسم</strong>.
        </p>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void handleExportTemplate()}>
          <Download className="h-4 w-4" />
          تحميل نموذج Excel
        </Button>
      </div>

      {/* Step 2 — Upload file */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">٢</span>
          <span className="font-medium text-sm">ارفع الملف المعبأ</span>
        </div>
        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
          <div className="flex flex-col items-center gap-1 pointer-events-none">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {fileName ? fileName : 'اضغط لاختيار ملف Excel'}
            </span>
            {!fileName && <span className="text-xs text-muted-foreground">.xlsx أو .xls</span>}
          </div>
          <input
            type="file"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={(e) => void handleFileChange(e)}
          />
        </label>
        {parseError && <p className="text-sm text-destructive">{parseError}</p>}
        {rows.length > 0 && (
          <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            تم قراءة <strong>{rows.length}</strong> صف من الملف
          </p>
        )}
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
            <span className="text-sm font-medium">معاينة البيانات</span>
            <span className="text-xs text-muted-foreground">
              {rows.length > 5 ? `أول 5 صفوف من ${rows.length}` : `${rows.length} صف`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20">
                  {previewCols.map((c) => (
                    <th key={c.label} className="px-3 py-2 text-right font-medium text-muted-foreground">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                    {previewCols.map((c) => (
                      <td key={c.label} className="px-3 py-2">{c.get(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3 — Mode + Import */}
      {rows.length > 0 && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">٣</span>
            <span className="font-medium text-sm">اختر الوضع وابدأ الاستيراد</span>
          </div>

          {/* Mode toggle */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">وضع الاستيراد</p>
            <div className="inline-flex rounded-lg border bg-muted p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setImportMode('insert')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  importMode === 'insert'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                إضافة فقط
              </button>
              <button
                type="button"
                onClick={() => setImportMode('upsert')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  importMode === 'upsert'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                تحديث وإضافة
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {importMode === 'insert'
                ? 'التجهيزات بنفس الرقم التسلسلي ستُرفض — مناسب للاستيراد الأوّلي.'
                : 'التجهيزات بنفس الرقم التسلسلي ستُحدَّث بالكامل — الجديدة ستُضاف تلقائياً.'}
            </p>
          </div>

          <Button onClick={() => void handleImport()} disabled={importing} className="gap-2">
            {importing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileSpreadsheet className="h-4 w-4" />}
            {importing ? 'جارٍ الاستيراد…' : `${importMode === 'upsert' ? 'تحديث/إضافة' : 'استيراد'} ${rows.length} تجهيز`}
          </Button>
        </div>
      )}

      {/* Results */}
      {result && (() => {
        const total = result.created + (result.updated ?? 0);
        const hasSuccess = total > 0;
        const summaryParts: string[] = [];
        if (result.created > 0) summaryParts.push(`إضافة ${result.created} تجهيز`);
        if ((result.updated ?? 0) > 0) summaryParts.push(`تحديث ${result.updated} تجهيز`);
        return (
          <div className={`rounded-lg border p-4 space-y-2 ${
            hasSuccess
              ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900'
              : 'border-destructive/30 bg-destructive/5'
          }`}>
            <div className="flex items-center gap-2">
              {hasSuccess
                ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                : <X className="h-5 w-5 text-destructive" />}
              <span className="font-medium text-sm">
                {hasSuccess
                  ? `تم ${summaryParts.join(' و')} بنجاح`
                  : 'لم يتم استيراد أي تجهيز'}
              </span>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  الأخطاء ({result.errors.length} صف):
                </p>
                <div className="max-h-36 overflow-y-auto space-y-0.5 rounded border bg-background p-2">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">
                      صف {e.row}: <span className="font-medium">{e.name}</span> — {e.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
