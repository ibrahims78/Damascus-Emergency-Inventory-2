# Damascus Emergency Inventory Desktop — Version 3.0.4

هذه حزمة Windows Portable مستقلة مبنية من آخر حالة للفرع `main` في مستودع المشروع. تتضمن مجلد التشغيل الكامل لـ Electron، وواجهة الويب الحالية، وخادم API المحلي، وقاعدة PGlite المحلية؛ ولا تحتاج PostgreSQL أو خادماً خارجياً للتشغيل المعتاد.

## التشغيل

1. فك ضغط `Damascus-Emergency-Inventory-v3.0.4-Windows.zip` على جهاز Windows x64.
2. افتح مجلد `Damascus Emergency Inventory 3.0.4`.
3. شغّل ملف `Damascus Emergency Inventory.exe`.

يُنشئ التطبيق قاعدة البيانات المحلية تلقائياً داخل مجلد بيانات التطبيق في حساب Windows. يمكن اختيارياً توجيه التطبيق إلى API خارجي عبر متغير البيئة `DAMASCUS_API_URL`.

## محتويات الإصدار

- الإصدار: `3.0.4`
- المصدر: الفرع `main`، commit `89aef4852ecd669a1d90dc5294ced9809d86d096`
- Windows x64 Portable — مجلد تشغيل كامل، وليس ملف التنفيذ وحده
- واجهة الويب وAPI مبنيان من نفس commit الحالي
- تحقق SHA-256 موجود في `SHA256SUMS`

هذه حزمة Portable غير موقعة رقمياً؛ قد يعرض Windows SmartScreen تحذيراً عند التشغيل الأول وفق سياسة الجهاز.
