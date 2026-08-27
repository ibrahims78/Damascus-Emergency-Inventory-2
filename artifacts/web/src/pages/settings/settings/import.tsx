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

export function ImportTab() {
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

export function ImportEquipmentTab() {
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

interface ImportRow {
  [key: string]: string | number | undefined;
}

interface ImportResult {
  created: number;
  updated?: number;
  errors: { row: number; name: string; error: string }[];
}


