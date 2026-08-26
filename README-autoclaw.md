# Damascus-Emergency-Inventory-autoclaw

نسخة عمل محلية من مشروع نظام مستودع الإسعاف والطوارئ — دمشق، معدة للعمل عليها
وتطبيق التعديلات والإصلاحات اللاحقة. **المجلد الأصلي لم يُعدَّل.**

## البيئة (Windows — وضع سطح المكتب PGlite، بدون PostgreSQL)

| الخدمة | المنفذ | الحالة |
|---|---|---|
| API (Express 5) | 8080 | PGlite محلي — `.damascus-data/` |
| Web (Vite 7) | 22333 | proxy إلى 8080 |

- **تسجيل الدخول:** `admin` / `Admin@1234`
- قاعدة البيانات: PGlite (PostgreSQL مدمج) — لا حاجة لخادم خارجي.
- البيانات محفوظة محلياً في `.damascus-data/` وتستمر بين عمليات التشغيل.

## أوامر سريعة

```powershell
# تشغيل البيئة كاملة (API + Web)
.\start-dev.ps1

# إيقاف البيئة
.\stop-dev.ps1

# إعادة بذر البيانات (بعد إيقاف الخادم)
.\seed-dev.ps1
```

## ملاحظات مهمة للعمل هنا

1. **تعديل محلي لملف `pnpm-workspace.yaml`** (لتوافق ويندوز): أُزيلت استثناءات
   ثنائيات win32-x64 (rollup/lightningcss/tailwind-oxide). الأصل محفوظ في
   `pnpm-workspace.yaml.bak-win`. **لا تُدمج هذه الملفات مع المستودع الأصلي**
   (بيئة Replit/Linux تحتاج الاستثناءات).
2. **ملفا `pglite.data`/`pglite.wasm`** يُنسخان من `releases/v3/app/api/` إلى
   `artifacts/api-server/dist/` بعد أي `pnpm run build` للخادم.
3. **البذرة:** تُشغَّل مباشرة عبر `node dist/seed.mjs` وليس `pnpm run seed`
   (سكربت seed.mjs الأصلي يفشل مع المسارات التي تحتوي مسافة في ويندوز).
4. **الخطة المعتمدة للتنفيذ:** `docs/equipment-inventory-adjustment-execution-plan-approved-ar.md`
   (توحيد تسوية جرد المواد والتجهيزات — 10 قرارات معتمدة، 8.5 يوم عمل).

## تحديثات هذا الفرع

- 2026-08-26: إنشاء نسخة العمل + تجهيز البيئة + بذر البيانات + تشغيل الاختبار.
