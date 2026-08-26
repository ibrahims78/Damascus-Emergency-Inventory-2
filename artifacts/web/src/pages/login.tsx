import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin, useGetCurrentUser, useGetSetupStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import logoUrl from '@assets/logo.jpeg';

const loginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading: isCheckingUser } = useGetCurrentUser();
  const { data: setupStatus, isLoading: isCheckingSetup } = useGetSetupStatus();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        setLocation('/');
      },
      onError: (err: any) => {
        if (err?.response?.status === 401) {
          setErrorMsg('اسم المستخدم أو كلمة المرور غير صحيحة.');
        } else {
          setErrorMsg('حدث خطأ أثناء الاتصال بالخادم. حاول مرة أخرى.');
        }
      }
    }
  });

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!isCheckingSetup && setupStatus?.needsSetup && location !== '/setup') {
      setLocation('/setup');
    }
  }, [isCheckingSetup, setupStatus, location, setLocation]);

  useEffect(() => {
    if (!isCheckingUser && user && location !== '/') {
      setLocation('/');
    }
  }, [isCheckingUser, user, location, setLocation]);

  if (isCheckingUser || isCheckingSetup) return null;
  if (setupStatus?.needsSetup || user) return null;

  const onSubmit = (data: LoginFormValues) => {
    setErrorMsg(null);
    loginMutation.mutate({ data });
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-xl overflow-hidden border">
        <div className="p-8 pb-6 text-center bg-muted/50 border-b">
          <img 
            src={logoUrl} 
            alt="شعار منظومة الإحالة والإسعاف والطوارئ"
            className="w-24 h-24 mx-auto object-contain rounded-full shadow-md bg-white p-2 mb-4" 
          />
          <h1 className="text-2xl font-bold text-foreground">منظومة الاحالة و الاسعاف و الطوارئ - دمشق</h1>
        </div>
        
        <div className="p-8">
          <h2 className="text-xl font-semibold mb-6 text-center">تسجيل الدخول للنظام</h2>
          
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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المستخدم</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="أدخل اسم المستخدم"
                        autoComplete="username"
                        {...field}
                        dir="ltr"
                        className="text-right"
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
                        placeholder="أدخل كلمة المرور"
                        autoComplete="current-password"
                        {...field}
                        dir="ltr"
                        className="text-right"
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
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? 'جاري تسجيل الدخول...' : 'دخول'}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}