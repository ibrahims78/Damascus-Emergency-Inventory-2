---
name: بناء Android في Replit
description: متطلبات JDK وAndroid SDK الخاصة ببناء APK في بيئة Replit لهذا المشروع.
---

يتطلب بناء Android الحالي JDK 21، لأن إصدار Capacitor Android المستخدم يضبط مصدر Java على 21؛ تشغيل Gradle على JDK 17 يفشل برسالة `invalid source release: 21`. عند عدم توفر حزمة `androidsdk` في فهرس البيئة، يمكن تجهيز Android command-line tools الرسمي وSDK Platform 35 وBuild Tools 35.0.0 في مجلد مؤقت ثم تمرير `ANDROID_SDK_ROOT` و`JAVA_HOME` أثناء البناء.

**Why:** بيئة Replit قد تحتوي عدة إصدارات JDK ولا تحتوي SDK Android كاملاً أو حزمة نظام باسم متوقع، لذلك اختيار Java تلقائياً قد يسبب فشل البناء قبل توقيع APK.

**How to apply:** افحص `android/app/capacitor.build.gradle` لمعرفة مستوى Java الفعلي، اختر JDK المطابق، ولا تضع SDK المؤقت أو keystore أو كلمات مرور التوقيع داخل Git.