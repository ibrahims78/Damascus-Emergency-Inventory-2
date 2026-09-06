# ملاحظات الإصدار 4.0.1 — النسخ العادية والمحمية

هذا إصدار تصحيحي مبني من الفرع `master` بعد `v4.0.0`. تم توحيد رقم الإصدار
في واجهة الويب، بوابة التفعيل، خادم الترخيص، مشروع Android وقوالب سطح المكتب.

## ما تم تحديثه

- رفع رقم نسخة Android إلى `versionName=4.0.1` و`versionCode=401`.
- استخدام حزمة الويب المحمية الصحيحة عند مزامنة Capacitor مع Android.
- إصلاح تعارض اسم متغير alias في إعداد توقيع Gradle.
- جعل مسارات مفاتيح التحقق قابلة للتحديد عبر `DAMASCUS_RELEASE_VERSION` مع إبقاء
  مسار `v4.0.0` كحل توافق للحزم القديمة.
- إصلاح سكربت إعادة تجميع Windows ليعمل من جذر المشروع بدلاً من مسار جهاز ثابت.
- مولّدات التفعيل الجديدة تحمل اسم `v4.0.1`، بينما تبقى المفاتيح الخاصة خارج Git.

## الحزم

ينبغي نشر هذه الملفات بعد نجاح بنائها والتحقق من بصماتها:

- `Damascus-Emergency-Inventory-v4.0.1-Windows-Offline.zip`
- `Damascus-Emergency-Inventory-v4.0.1-Windows-Protected.zip`
- `Damascus-Emergency-Inventory-v4.0.1-Android-Offline.apk`
- `Damascus-Emergency-Inventory-v4.0.1-Android-Protected.apk`
- مولّدا التفعيل `KeyGenerator-v4.0.1-P-Windows` و`KeyGenerator-v4.0.1-P-Android`
- ملفات `SHA256SUMS-windows.txt` و`SHA256SUMS-android.txt`

## حدود التحقق

تمت مراجعة المصدر ومسارات الحماية آلياً. بناء Windows الأصلي يحتاج بيئة Windows
أو أداة PowerShell، وبناء Android يحتاج JDK 17 وAndroid SDK مع Build Tools
المناسبة. لا يُعلن عن أي حزمة على أنها مختبرة بالكامل قبل نجاح البناء والتوقيع
والتحقق من SHA-256 في بيئة البناء المناسبة.