// src/setup.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🛠️  Running setup script...');

// ===== تابع: گرفتن ID دیتابیس D1 =====
function getD1DatabaseId(name: string): string | null {
  try {
    // D1 list --json در Wrangler 4 کار می‌کنه
    const output = execSync(`npx wrangler d1 list --json`, { encoding: 'utf8' });
    const databases = JSON.parse(output);
    const db = databases.find((d: any) => d.name === name);
    return db?.uuid || db?.id || null;
  } catch {
    // اگر --json کار نکرد، با regex از خروجی متن
    try {
      const output = execSync(`npx wrangler d1 list`, { encoding: 'utf8' });
      const match = output.match(new RegExp(`([a-f0-9-]{36})\\s+${name}`));
      return match?.[1] || null;
    } catch {
      return null;
    }
  }
}

// ===== تابع: گرفتن ID KV Namespace =====
function getKvNamespaceId(title: string): string | null {
  try {
    // KV list بدون --json (خروجی پیش‌فرض JSON هست)
    const output = execSync(`npx wrangler kv namespace list`, { encoding: 'utf8' });
    const namespaces = JSON.parse(output);
    const ns = namespaces.find((n: any) => n.title === title);
    return ns?.id || null;
  } catch {
    // اگر JSON کار نکرد، با regex از خروجی متن
    try {
      const output = execSync(`npx wrangler kv namespace list`, { encoding: 'utf8' });
      const match = output.match(new RegExp(`([a-f0-9-]{36})\\s+${title}`));
      return match?.[1] || null;
    } catch {
      return null;
    }
  }
}

// ===== تابع: ساخت resource اگر وجود نداشت =====
function ensureResource(
  name: string,
  type: 'd1' | 'kv',
  createCommand: string,
  getId: () => string | null
): string {
  console.log(`🔍 Checking ${type} "${name}"...`);
  
  // ۱. اول ببین وجود داره یا نه
  let id = getId();
  if (id) {
    console.log(`✅ ${type} already exists: ${id}`);
    return id;
  }

  // ۲. اگر وجود نداشت، بسازش
  console.log(`📦 Creating ${type}...`);
  try {
    execSync(createCommand, { stdio: 'inherit' });
    // بعد از ساخت، دوباره ID رو بگیر
    id = getId();
    if (id) {
      console.log(`✅ ${type} created: ${id}`);
      return id;
    }
    // اگر ID پیدا نشد، ارور بده
    console.error(`❌ ${type} created but could not retrieve ID`);
    process.exit(1);
  } catch (err: any) {
    // اگه خطای "already exists" بود، دوباره ID رو بگیر
    if (err.stderr?.includes('already exists') || err.message?.includes('already exists')) {
      console.log(`⏳ ${type} already exists (detected from error), checking again...`);
      id = getId();
      if (id) {
        console.log(`✅ ${type} already exists: ${id}`);
        return id;
      }
    }
    console.error(`❌ Failed to create ${type}:`, err);
    process.exit(1);
  }
}

// ===== 1. D1 Database =====
const dbId = ensureResource(
  'kimaraye-ahanin-db',
  'D1 database',   // ← این رو به 'd1' تغییر بده
  'npx wrangler d1 create kimaraye-ahanin-db',
  () => getD1DatabaseId('kimaraye-ahanin-db')
);

// ===== 2. KV Namespace =====
const kvId = ensureResource(
  'KV',
  'KV namespace',   // ← این رو به 'kv' تغییر بده
  'npx wrangler kv namespace create KV',
  () => getKvNamespaceId('KV')
);

// ===== 3. Update wrangler.jsonc =====
const wranglerPath = path.join(process.cwd(), 'wrangler.jsonc');
try {
  let content = fs.readFileSync(wranglerPath, 'utf8');
  content = content.replace(/"YOUR_DATABASE_ID"/g, `"${dbId}"`);
  content = content.replace(/"YOUR_KV_ID"/g, `"${kvId}"`);
  fs.writeFileSync(wranglerPath, content, 'utf8');
  console.log('✅ wrangler.jsonc updated with real IDs');
  console.log(`   D1 ID: ${dbId}`);
  console.log(`   KV ID: ${kvId}`);
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
