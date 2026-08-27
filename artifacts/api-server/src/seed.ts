import { db, categoriesTable, usersTable, recipientsTable, exitReasonsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

async function seed() {
  console.log("ðŸŒ± Seeding database...");

  // Seed categories
  const categories = [
    { name: "Ø«ÙˆØ§Ø¨Øª", type: "consumable" as const },
    { name: "Ù…Ø³ØªÙ‡Ù„ÙƒØ§Øª Ø·Ø¨ÙŠØ©", type: "consumable" as const },
    { name: "Ù…Ø³ØªÙ‡Ù„ÙƒØ§Øª Ù…Ù†ÙˆØ¹Ø©", type: "consumable" as const },
    { name: "ØªØ¬Ù‡ÙŠØ²Ø§Øª", type: "equipment" as const },
  ];

  for (const cat of categories) {
    await db
      .insert(categoriesTable)
      .values(cat)
      .onConflictDoNothing({ target: categoriesTable.name });
  }
  console.log("âœ… Categories seeded");

  // Seed admin user
  // Seed admin user. Never ship a well-known default password: when
  // SEED_ADMIN_PASSWORD is not provided, a random password is generated,
  // printed once to the console, and the mustChangePassword flag forces a
  // change at first login.
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  const generatedPassword = randomBytes(12).toString("base64url"); // 16 chars
  const adminPassword = seedPassword ?? generatedPassword;
  const mustChange = !seedPassword;
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  await db
    .insert(usersTable)
    .values({
      username: "admin",
      passwordHash: adminPasswordHash,
      fullName: "Ù…Ø¯ÙŠØ± Ø§Ù„Ù†Ø¸Ø§Ù…",
      role: "admin",
      mustChangePassword: mustChange,
    })
    .onConflictDoNothing({ target: usersTable.username });
  if (seedPassword) {
    console.log(`âœ… Admin user seeded (username: admin, password: ${seedPassword})`);
  } else {
    console.log("âœ… Admin user seeded with a randomly generated password");
    console.log(`ðŸ”‘ One-time admin password: ${generatedPassword}`);
    console.log("   The user must change it at first login (mustChangePassword).");
  }

  // Seed recipients
  const recipients = [
    { name: "Ù…Ø±ÙƒØ² Ø§Ù„Ø¥Ø³Ø¹Ø§Ù Ø§Ù„Ù…Ø±ÙƒØ²ÙŠ" },
    { name: "Ù…Ø±ÙƒØ² Ø¥Ø³Ø¹Ø§Ù Ø§Ù„Ù…Ø²Ø©" },
    { name: "Ù…Ø±ÙƒØ² Ø¥Ø³Ø¹Ø§Ù ÙƒÙØ±Ø³ÙˆØ³Ø©" },
    { name: "Ù…Ø±ÙƒØ² Ø¥Ø³Ø¹Ø§Ù Ø±ÙƒÙ† Ø§Ù„Ø¯ÙŠÙ†" },
    { name: "Ù…Ø±ÙƒØ² Ø¥Ø³Ø¹Ø§Ù Ø§Ù„Ù…ÙŠØ¯Ø§Ù†" },
    { name: "Ù…Ø³ØªØ´ÙÙ‰ Ø§Ù„Ù…Ø¬ØªÙ‡Ø¯" },
    { name: "Ù…Ø³ØªØ´ÙÙ‰ Ø§Ø¨Ù† Ø§Ù„Ù†ÙÙŠØ³" },
    { name: "Ø§Ù„Ù…Ø³ØªØ´ÙÙ‰ Ø§Ù„Ø¬Ø§Ù…Ø¹ÙŠ" },
  ];

  for (const recipient of recipients) {
    await db
      .insert(recipientsTable)
      .values(recipient)
      .onConflictDoNothing();
  }
  console.log("âœ… Recipients seeded");

  // Seed exit reasons
  const exitReasons = [
    { name: "ØµØ±Ù Ù„Ù…Ø±ÙƒØ² Ø¥Ø³Ø¹Ø§Ù" },
    { name: "ØµØ±Ù Ù„Ù…Ø³ØªØ´ÙÙ‰" },
    { name: "ØµØ±Ù Ø¯Ø§Ø®Ù„ÙŠ" },
    { name: "ØªÙ„Ù / Ø§Ù†ØªÙ‡Ø§Ø¡ ØµÙ„Ø§Ø­ÙŠØ©" },
    { name: "ÙÙ‚Ø¯Ø§Ù†" },
    { name: "ØªØ­ÙˆÙŠÙ„ Ø¥Ù„Ù‰ Ø¬Ù‡Ø© Ø£Ø®Ø±Ù‰" },
    { name: "Ø§Ø³ØªÙ‡Ù„Ø§Ùƒ Ù…ÙŠØ¯Ø§Ù†ÙŠ" },
    { name: "ØªØ¯Ø±ÙŠØ¨" },
  ];

  for (const reason of exitReasons) {
    await db
      .insert(exitReasonsTable)
      .values(reason)
      .onConflictDoNothing();
  }
  console.log("âœ… Exit reasons seeded");

  console.log("ðŸŽ‰ Database seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("âŒ Seeding failed:", err);
  process.exit(1);
});
