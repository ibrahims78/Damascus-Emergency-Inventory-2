import { useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { storeCsrfToken } from '@/lib/csrf-client';
import {
  AccessDeniedState,
  ConnectionErrorState,
  LoadingState,
} from '@/components/app-state';
import { SessionExpiryDialog } from '@/components/session-expiry-dialog';

// Layout
import { Shell } from '@/components/layout/shell';

// Pages
import NotFound from '@/pages/not-found';
import { LoginPage } from '@/pages/login';
import { SetupPage } from '@/pages/setup';
import { ChangePasswordPage } from '@/pages/change-password';
import { DashboardPage } from '@/pages/dashboard';
import { ItemsPage } from '@/pages/items';
import { EquipmentPage } from '@/pages/equipment';
import { TransactionsPage } from '@/pages/transactions';
import { ReportsPage } from '@/pages/reports';
import { UsersPage } from '@/pages/users';
import { SettingsPage } from '@/pages/settings';
import { AuditPage } from '@/pages/audit';
import { SyncPage } from '@/pages/sync';
import { HelpPage } from '@/pages/help';
import { PrintTransactionPage } from '@/pages/print-transaction';
import { AdjustmentForm } from '@/pages/adjustment-form';
import { ItemDetailsPage } from '@/pages/item-details';
import { CustodyDetailsPage } from '@/pages/custody-details';
import {
  CentralReturnForm,
  CustodyOutForm,
  CustodyReturnForm,
  DamageForm,
} from '@/pages/inventory-lifecycle-forms';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: true,
    },
  },
});

function ProtectedRoute({
  component: Component,
  adminOnly = false,
}: {
  component: React.ComponentType;
  adminOnly?: boolean;
}) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError, error, refetch } = useGetCurrentUser();
  const status = (error as unknown as { response?: { status?: number } } | null | undefined)
    ?.response?.status;
  // An initial unauthenticated request should reach the login/setup flow.
  // The dialog is reserved for a session that had a cached user and then expired.
  const isSessionExpired = isError && (status === 401 || status === 403) && Boolean(user);

  // Keep the CSRF token available to the fetch wrapper (issued at login and
  // refreshed on every /me round trip).
  useEffect(() => {
    storeCsrfToken((user as { csrfToken?: string } | undefined)?.csrfToken ?? null);
  }, [user]);

  // Must be called unconditionally before any early returns
  useEffect(() => {
    if (!isLoading && !isSessionExpired && isError && location !== '/login') {
      setLocation('/login');
    }
    const current = user as { mustChangePassword?: boolean } | undefined;
    if (!isLoading && user && current?.mustChangePassword && location !== '/change-password') {
      setLocation('/change-password');
    }
  }, [isLoading, isError, isSessionExpired, user, location, setLocation]);

  if (isLoading) {
    return <LoadingState label="جاري التحقق من جلسة الدخول..." />;
  }

  if (isSessionExpired) {
    return (
      <SessionExpiryDialog
        open
        onContinue={() => {
          queryClient.clear();
          storeCsrfToken(null);
          setLocation('/login');
        }}
      />
    );
  }

  if (isError) {
    return (
      <ConnectionErrorState
        onRetry={() => {
          void refetch();
        }}
        title="تعذر الاتصال بالخادم الداخلي"
        description="لم يتمكن التطبيق من الوصول إلى قاعدة البيانات المحلية. تحقق من الاتصال ثم حاول مرة أخرى."
      />
    );
  }

  if (!user) return null;

  if (adminOnly && user.role !== 'admin') {
    return <AccessDeniedState onBack={() => setLocation('/')} />;
  }

  return (
    <Shell>
      <Component />
    </Shell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/setup" component={SetupPage} />
      <Route path="/login" component={LoginPage} />

      {/* Protected Routes */}
      <Route path="/"><ProtectedRoute component={DashboardPage} /></Route>
      <Route path="/items"><ProtectedRoute component={ItemsPage} /></Route>
      <Route path="/items/new"><ProtectedRoute component={ItemsPage} /></Route>
      <Route path="/items/:id/edit"><ProtectedRoute component={ItemsPage} /></Route>
      <Route path="/items/:id/adjust"><ProtectedRoute component={ItemsPage} /></Route>
      <Route path="/items/:id"><ProtectedRoute component={ItemDetailsPage} /></Route>

      <Route path="/equipment"><ProtectedRoute component={EquipmentPage} /></Route>
      <Route path="/equipment/new"><ProtectedRoute component={EquipmentPage} /></Route>
      <Route path="/equipment/:id/edit"><ProtectedRoute component={EquipmentPage} /></Route>
      <Route path="/equipment/:id/adjust"><ProtectedRoute component={EquipmentPage} /></Route>
      <Route path="/equipment/:id"><ProtectedRoute component={EquipmentPage} /></Route>
      <Route path="/custodies/:id"><ProtectedRoute component={CustodyDetailsPage} /></Route>

      <Route path="/transactions"><ProtectedRoute component={TransactionsPage} /></Route>
      <Route path="/transactions/in/new"><ProtectedRoute component={TransactionsPage} /></Route>
      <Route path="/transactions/out/new"><ProtectedRoute component={TransactionsPage} /></Route>
      <Route path="/custody/out/new"><ProtectedRoute component={CustodyOutForm} /></Route>
      <Route path="/custody/return/new"><ProtectedRoute component={CustodyReturnForm} /></Route>
      <Route path="/damage/new"><ProtectedRoute component={DamageForm} /></Route>
      <Route path="/central-return/new"><ProtectedRoute component={CentralReturnForm} /></Route>

      <Route path="/reports"><ProtectedRoute component={ReportsPage} /></Route>
      <Route path="/help"><ProtectedRoute component={HelpPage} /></Route>

      {/* Admin-only routes */}
      <Route path="/users"><ProtectedRoute component={UsersPage} adminOnly /></Route>
      <Route path="/audit"><ProtectedRoute component={AuditPage} adminOnly /></Route>
      <Route path="/sync"><ProtectedRoute component={SyncPage} adminOnly /></Route>
      <Route path="/change-password"><ProtectedRoute component={ChangePasswordPage} /></Route>
      <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>

      {/* Print Route (No shell) */}
      <Route path="/print/:id" component={PrintTransactionPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="damascus-ems-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
