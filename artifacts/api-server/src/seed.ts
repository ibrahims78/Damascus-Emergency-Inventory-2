import { db, categoriesTable, usersTable, recipientsTable, exitReasonsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding database...");

  // Seed categories
  const categories = [
    { name: "ثوابت", type: "consumable" as const },
    { name: "مستهلكات طبية", type: "consumable" as const },
    { name: "مستهلكات منوعة", type: "consumable" as const },
    { name: "تجهيزات", type: "equipment" as const },
  ];

  for (const cat of categories) {
    await db
      .insert(categoriesTable)
      .values(cat)
      .onConflictDoNothing({ target: categoriesTable.name });
  }
  console.log("✅ Categories seeded");

  // Seed admin user
  const adminPassword = await bcrypt.hash("Admin@1234", 10);
  await db
    .insert(usersTable)
    .values({
      username: "admin",
      passwordHash: adminPassword,
      fullName: "مدير النظام",
      role: "admin",
    })
    .onConflictDoNothing({ target: usersTable.username });
  console.log("✅ Admin user seeded (username: admin, password: Admin@1234)");

  // Seed recipients
  const recipients = [
    { name: "مركز الإسعاف المركزي" },
    { name: "مركز إسعاف المزة" },
    { name: "مركز إسعاف كفرسوسة" },
    { name: "مركز إسعاف ركن الدين" },
    { name: "مركز إسعاف الميدان" },
    { name: "مستشفى المجتهد" },
    { name: "مستشفى ابن النفيس" },
    { name: "المستشفى الجامعي" },
  ];

  for (const recipient of recipients) {
    await db
      .insert(recipientsTable)
      .values(recipient)
      .onConflictDoNothing();
  }
  console.log("✅ Recipients seeded");

  // Seed exit reasons
  const exitReasons = [
    { name: "صرف لمركز إسعاف" },
    { name: "صرف لمستشفى" },
    { name: "صرف داخلي" },
    { name: "تلف / انتهاء صلاحية" },
    { name: "فقدان" },
    { name: "تحويل إلى جهة أخرى" },
    { name: "استهلاك ميداني" },
    { name: "تدريب" },
  ];

  for (const reason of exitReasons) {
    await db
      .insert(exitReasonsTable)
      .values(reason)
      .onConflictDoNothing();
  }
  console.log("✅ Exit reasons seeded");

  console.log("🎉 Database seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
