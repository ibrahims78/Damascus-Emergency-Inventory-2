# Damascus Emergency Inventory — Windows Portable `3.0.2`

حزمة Windows Portable كاملة من نظام مستودع الإسعاف والطوارئ — دمشق، مبنية من آخر commit في الفرع `main`.

## المحتوى

- `Damascus-Emergency-Inventory-v3.0.2-Windows.zip` — ملف ZIP يحتوي مجلد التشغيل الكامل لـ Windows x64.
- `SHA256SUMS` — مجموع SHA-256 للتحقق من سلامة الملف.

## التشغيل

1. فك ضغط الملف ZIP على جهاز Windows.
2. افتح مجلد `Damascus Emergency Inventory 3.0.2`.
3. شغّل `Damascus Emergency Inventory.exe` مباشرة؛ لا يحتاج إلى مثبت منفصل أو PostgreSQL.
4. يحتفظ التطبيق بقاعدة البيانات المحلية داخل مجلد بيانات المستخدم.

## الإصدار

- الإصدار: `3.0.2`
- المنصة: Windows x64 Portable
- مبني من commit الإصلاحات `1396d787adbaa017541da8e52f0bf58632831ad4` على `main`.
- يتضمن الواجهة وAPI المحلي وقاعدة PGlite المضمنة اللازمة للتشغيل المستقل.
- تم تضمين ملف التشغيل الكامل وجميع ملفات Electron المطلوبة، وليس ملف التنفيذ وحده.
