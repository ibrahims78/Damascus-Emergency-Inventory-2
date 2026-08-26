import { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useListItems, type Item } from '@workspace/api-client-react';
import { ArrowRight, Save, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CatalogCombobox } from '@/components/catalog-combobox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  itemId: z.coerce.number({ required_error: 'يرجى اختيار المادة' }).min(1, 'يرجى اختيار المادة'),
  newStock: z.coerce.number({ required_error: 'الكمية الصحيحة مطلوبة' }).min(0, 'الكمية لا يمكن أن تكون سالبة'),
  reason: z.string().min(3, 'سبب التسوية مطلوب (3 أحرف على الأقل)'),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

export function AdjustmentForm({ preselectedItemId }: { preselectedItemId?: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);

  const { data: itemsData } = useListItems({ limit: 5000 });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      itemId: preselectedItemId ?? ('' as unknown as number),
      newStock: '' as unknown as number,
      reason: '',
      notes: '',
    },
  });

  const watchItemId = form.watch('itemId');
  const watchNewStock = form.watch('newStock');

  const selectedItem =
    watchItemId && itemsData?.items
      ? itemsData.items.find((i: Item) => i.id === Number(watchItemId))
      : null;

  const delta =
    selectedItem !== null && selectedItem !== undefined && watchNewStock !== undefined && watchNewStock !== null && watchNewStock !== ('' as unknown as number)
      ? Number(watchNewStock) - selectedItem.currentStock
      : null;

  const adjustMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await fetch('/api/transactions/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          itemId: data.itemId,
          newStock: data.newStock,
          reason: data.reason,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || 'حدث خطأ أثناء الحفظ');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listItems'] });
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['listTransactions'] });
      toast({ description: '✅ تمت تسوية الجرد بنجاح' });
      setLocation('/items');
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', description: err.message });
      setConfirmed(false);
    },
  });

  const handleSubmit = (data: FormValues) => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    adjustMutation.mutate(data);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/items')}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">تسوية جرد</h1>
            <p className="text-sm text-muted-foreground">تصحيح كمية مادة مباشرة مع توثيق السبب</p>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg shadow-sm p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

            {/* Item Select */}
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المادة *</FormLabel>
                  <FormControl>
                    <CatalogCombobox
                      value={field.value ? field.value.toString() : ''}
                      open={itemPickerOpen}
                      onOpenChange={setItemPickerOpen}
                      onValueChange={(value) => {
                        field.onChange(Number(value));
                        setConfirmed(false);
                        form.setValue('newStock', '' as unknown as number);
                      }}
                      placeholder="اختر المادة من القائمة..."
                      searchPlaceholder="ابحث باسم المادة أو رمزها..."
                      emptyMessage="لا توجد مادة مطابقة"
                      loading={!itemsData}
                      disabled={!!preselectedItemId}
                      options={(itemsData?.items ?? [])
                        .filter((item: Item) => item.isActive)
                        .map((item: Item) => ({
                          value: item.id.toString(),
                          searchValue: `${item.id} ${item.name} ${item.code ?? ''} ${item.batchNumber ?? ''}`,
                          label: (
                            <>
                              {item.name}
                              {item.code ? ` (${item.code})` : ''} — رصيد: {item.currentStock}{' '}
                              {item.unit}
                            </>
                          ),
                        }))}
                    />
                  </FormControl>

                  {/* Current stock info */}
                  {selectedItem && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-md flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">الرصيد الحالي في النظام:</span>
                      <Badge
                        variant={
                          selectedItem.currentStock <= selectedItem.minStock ? 'destructive' : 'secondary'
                        }
                      >
                        {selectedItem.currentStock} {selectedItem.unit}
                      </Badge>
                      {selectedItem.currentStock <= selectedItem.minStock && (
                        <span className="text-destructive text-xs">
                          ⚠ أقل من الحد الأدنى ({selectedItem.minStock} {selectedItem.unit})
                        </span>
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New Stock */}
            <FormField
              control={form.control}
              name="newStock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    الكمية الصحيحة (الرصيد الفعلي) *
                    {selectedItem && (
                      <span className="font-normal text-muted-foreground mr-2 text-xs">
                        ({selectedItem.unit})
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        field.onChange(e.target.value === '' ? '' : e.target.valueAsNumber);
                        setConfirmed(false);
                      }}
                      className="max-w-[200px]"
                      placeholder="أدخل الكمية الفعلية..."
                    />
                  </FormControl>

                  {/* Delta indicator */}
                  {selectedItem && delta !== null && !isNaN(delta) && (
                    <div className={`mt-1.5 flex items-center gap-2 text-sm font-medium ${
                      delta > 0
                        ? 'text-success'
                        : delta < 0
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}>
                      {delta > 0 ? (
                        <span>▲ زيادة {delta} {selectedItem.unit}</span>
                      ) : delta < 0 ? (
                        <span>▼ نقص {Math.abs(delta)} {selectedItem.unit}</span>
                      ) : (
                        <span>لا تغيير في الكمية</span>
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>سبب التسوية *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="مثال: جرد فعلي، تلف، خطأ في الإدخال السابق..."
                      onChange={(e) => { field.onChange(e); setConfirmed(false); }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات إضافية (اختياري)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ''}
                      className="h-20 resize-none"
                      placeholder="أي تفاصيل إضافية..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confirmation banner */}
            {confirmed && !adjustMutation.isPending && selectedItem && delta !== null && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-md text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-300 mb-1">تأكيد التسوية</p>
                  <p className="text-foreground/80">
                    سيتم تغيير رصيد <strong>{selectedItem.name}</strong> من{' '}
                    <strong>{selectedItem.currentStock}</strong> إلى{' '}
                    <strong>{Number(watchNewStock)}</strong> {selectedItem.unit}
                    {delta !== 0 && (
                      <span className={delta > 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>
                        {' '}({delta > 0 ? '+' : ''}{delta})
                      </span>
                    )}
                    . هذا الإجراء لا يمكن التراجع عنه تلقائياً.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/items')}
                disabled={adjustMutation.isPending}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={adjustMutation.isPending}
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Save className="w-4 h-4" />
                {adjustMutation.isPending
                  ? 'جاري الحفظ...'
                  : confirmed
                  ? 'تأكيد التسوية'
                  : 'حفظ التسوية'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
