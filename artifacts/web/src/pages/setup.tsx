import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSetupAdmin, useGetSetupStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import logoUrl from '@assets/logo.jpeg';

const setupSchema = z
  .object({
    fullName: z.string().min(2, 'الاسم الكامل مطلوب'),
    username: z
      .string()
      .min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
      .regex(/^[a-zA-Z0-9_]+$/, 'يُسمح فقط بالحروف الإنجليزية والأرقام والشرطة السفلية'),
    password: z
      .string()
      .min(12, 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل')
      .regex(/[A-Z]/, 'يجب أن تحتوي على حرف كبير')
      .regex(/[a-z]/, 'يجب أن تحتوي على حرف صغير')
      .regex(/[0-9]/, 'يجب أن تحتوي على رقم')
      .regex(/[^A-Za-z0-9]/, 'يجب أن تحتوي على رمز'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });

type SetupFormValues = z.infer<typeof setupSchema>;

export function SetupPage() {
  const [location, setLocation] = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: status, isLoading: isCheckingStatus } = useGetSetupStatus();

  const setupMutation = useSetupAdmin({
    mutation: {
      onSuccess: () => {
        setLocation('/');
      },
      onError: (err: any) => {
        if (err?.response?.status === 409) {
          setErrorMsg('يوجد مدير مسجّل بالفعل. يرجى تسجيل الدخول.');
        } else {
          setErrorMsg('حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.');
        }
      },
    },
  });

  const form = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      fullName: '',
      username: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!isCheckingStatus && status && !status.needsSetup && location !== '/login') {
      setLocation('/login');
    }
  }, [isCheckingStatus, status, location, setLocation]);

  if (isCheckingStatus || (status && !status.needsSetup)) return null;

  const onSubmit = (data: SetupFormValues) => {
    setErrorMsg(null);
    setupMutation.mutate({
      data: { username: data.username, password: data.password, fullName: data.fullName },
    });
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-xl overflow-hidden border">
        {/* Header */}
        <div className="p-8 pb-6 text-center bg-muted/50 border-b">
          <img
            src={logoUrl}
            alt="شعار منظومة الإحالة والإسعاف والطوارئ"
            className="w-24 h-24 mx-auto object-contain rounded-full shadow-md bg-white p-2 mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground">منظومة الاحالة و الاسعاف و الطوارئ - دمشق</h1>
        </div>

        {/* Setup Form */}
        <div className="p-8">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">إعداد حساب المدير</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            أنت تقوم بإعداد النظام لأول مرة. أدخل بيانات حساب المدير الرئيسي.
          </p>

          {errorMsg && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم الكامل</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: أحمد محمد" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المستخدم</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="مثال: admin"
                        {...field}
                        dir="ltr"
                        className="text-right"
                        autoComplete="username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="12 حرفاً: كبير وصغير ورقم ورمز"
                        {...field}
                        dir="ltr"
                        className="text-right"
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تأكيد كلمة المرور</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="أعد إدخال كلمة المرور"
                        {...field}
                        dir="ltr"
                        className="text-right"
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full mt-6"
                size="lg"
                disabled={setupMutation.isPending}
              >
                {setupMutation.isPending ? 'جاري إنشاء الحساب...' : 'إنشاء حساب المدير والدخول'}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
