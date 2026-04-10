/**
 * ═══════════════════════════════════════════════
 * Seed Script — إنشاء حساب الأدمن الأول
 * ═══════════════════════════════════════════════
 * 
 * يُشغّل مرة وحدة عند نشر النظام لأول مرة:
 *   npm run seed
 * 
 * - إذا ما في أدمن → ينشئ أول حساب أدمن
 * - إذا في أدمن → ما يعمل شي (آمن للتشغيل المتكرر)
 * - كلمة المرور الأولية مؤقتة → الأدمن لازم يغيرها
 */

const prisma = require('./src/config/database');
const bcrypt = require('bcryptjs');

const INITIAL_ADMIN = {
  username: 'admin',
  email: 'admin@bus-system.com',
  password: 'ChangeMe@2026',  // مؤقتة — لازم تتغير بأول دخول
  phone: null,
  role: 'admin',
};

async function seed() {
  console.log('🌱 Checking for existing admin...');

  // شوف إذا في أدمن
  const existingAdmin = await prisma.users.findFirst({
    where: { role: 'admin' },
  });

  if (existingAdmin) {
    console.log(`✅ Admin already exists: ${existingAdmin.email}`);
    console.log('   No action needed.');
    process.exit(0);
  }

  // ما في أدمن → أنشئ واحد
  console.log('📝 No admin found. Creating initial admin...');

  const hashedPassword = await bcrypt.hash(INITIAL_ADMIN.password, 10);

  const admin = await prisma.users.create({
    data: {
      username: INITIAL_ADMIN.username,
      email: INITIAL_ADMIN.email,
      password: hashedPassword,
      phone: INITIAL_ADMIN.phone,
      role: INITIAL_ADMIN.role,
      must_change_password: true,  // ← لازم يغيّر كلمة المرور
    },
  });

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  ✅ Initial admin created successfully');
  console.log('═══════════════════════════════════════');
  console.log(`  Email:    ${INITIAL_ADMIN.email}`);
  console.log(`  Password: ${INITIAL_ADMIN.password}`);
  console.log('');
  console.log('  ⚠️  This password is temporary.');
  console.log('  Change it immediately after first login.');
  console.log('═══════════════════════════════════════');

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
