import { useGetCurrentUser } from '@workspace/api-client-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User as UserIcon,
  KeyRound,
  Activity,
  Building2,
  Tag,
  UsersRound,
  ListChecks,
  Ruler,
  Wrench,
  DatabaseBackup,
  FileSpreadsheet,
} from 'lucide-react';
import { ProfileTab } from './profile';
import { PasswordTab } from './password';
import { ActivityTab } from './activity';
import { OrgTab } from './org';
import { UnitsTab } from './units';
import { TechnicalConditionsTab } from './technical';
import { BackupTab } from './backup';
import { CategoriesTab, RecipientsTab, ExitReasonsTab } from './catalog';
import { ImportTab, ImportEquipmentTab } from './import';

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
