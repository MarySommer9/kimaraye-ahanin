// src/setup.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🛠️  Running setup script...');

// ===== تابع کمکی برای ساخت resource اگر وجود نداشت =====
function createIfNotExists(command: string, label: string): string | null {
  try {
    console.log(`📦 ${label}...`);
    const output = execSync(command, { encoding: 'utf8' });
    console.log(`✅ ${label} created`);
    // استخراج ID از خروجی
    const match = output.match(/([a-f0-9-]{36})/);
    return match?.[1] || null;
  } catch (error: any) {
    // اگر خطای "already exists" بود، ادامه بده
    if (error.stderr?.includes('already exists') || error.message?.includes('already exists')) {
      console.log(`✅ ${label} already exists, skipping`);
      // اگر قبلاً وجود داشت، ID رو با `list` پیدا می‌کنیم
      return findExistingId(label);
    }
    console.error(`❌ Failed to create ${label}:`, error);
    return null;
  }
}

// ===== پیدا کردن ID resourceهای موجود =====
function findExistingId(label: string): string | null {
  try {
    // برای D1
    if (label.includes('D1')) {
      const output = execSync('npx wrangler d1 list', { encoding: 'utf8' });
      const match = output.match(/([a-f0-9-]{36})\s+kimaraye-ahanin-db/);
      return match?.[1] || null;
    }
    // برای KV
    if (label.includes('KV')) {
      const output = execSync('npx wrangler kv namespace list', { encoding: 'utf8' });
      const match = output.match(/([a-f0-9-]{36})\s+KV/);
      return match?.[1] || null;
    }
    return null;
  } catch {
    return null;
  }
}

// ===== 1. D1 Database =====
const dbId = createIfNotExists(
  'npx wrangler d1 create kimaraye-ahanin-db',
  'Creating D1 database'
);

if (!dbId) {
  console.error('❌ Could not get D1 database ID');
  process.exit(1);
}
console.log(`📌 D1 database ID: ${dbId}`);

// ===== 2. KV Namespace =====
const kvId = createIfNotExists(
  'npx wrangler kv namespace create KV',
  'Creating KV namespace'
);

if (!kvId) {
  console.error('❌ Could not get KV namespace ID');
  process.exit(1);
}
console.log(`📌 KV namespace ID: ${kvId}`);

// ===== 3. Update wrangler.jsonc =====
const wranglerPath = path.join(process.cwd(), 'wrangler.jsonc');
try {
  let content = fs.readFileSync(wranglerPath, 'utf8');
  content = content.replace(/"YOUR_DATABASE_ID"/g, `"${dbId}"`);
  content = content.replace(/"YOUR_KV_ID"/g, `"${kvId}"`);
  fs.writeFileSync(wranglerPath, content, 'utf8');
  console.log('✅ wrangler.jsonc updated with real IDs');
} catch (err) {
  console.error('❌ Failed to update wrangler.jsonc:', err);
  process.exit(1);
}

// ===== 4. Run schema on D1 =====
try {
  console.log('📊 Running schema on D1...');
  execSync('npx wrangler d1 execute kimaraye-ahanin-db --file=./database/schema.sql', { stdio: 'inherit' });
  console.log('✅ Schema executed successfully');
} catch (err) {
  console.error('❌ Failed to execute schema:', err);
  process.exit(1);
}

console.log('🎉 Setup completed successfully!');
