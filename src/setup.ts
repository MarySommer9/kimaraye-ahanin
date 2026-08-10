// src/setup.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

console.log('🛠️  Running setup script...');

// ===== تولید توکن تصادفی =====
function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// ===== تابع: گرفتن ID دیتابیس D1 =====
function getD1DatabaseId(name: string): string | null {
  try {
    const output = execSync(`npx wrangler d1 list --json`, { encoding: 'utf8' });
    const databases = JSON.parse(output);
    const db = databases.find((d: any) => d.name === name);
    return db?.uuid || db?.id || null;
  } catch {
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
    const output = execSync(`npx wrangler kv namespace list`, { encoding: 'utf8' });
    const namespaces = JSON.parse(output);
    const ns = namespaces.find((n: any) => n.title === title);
    return ns?.id || null;
  } catch {
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
  const label = type === 'd1' ? 'D1 database' : 'KV namespace';
  console.log(`🔍 Checking ${label} "${name}"...`);
  
  let id = getId();
  if (id) {
    console.log(`✅ ${label} already exists: ${id}`);
    return id;
  }

  console.log(`📦 Creating ${label}...`);
  try {
    execSync(createCommand, { stdio: 'inherit' });
    id = getId();
    if (id) {
      console.log(`✅ ${label} created: ${id}`);
      return id;
    }
    console.error(`❌ ${label} created but could not retrieve ID`);
    process.exit(1);
  } catch (err: any) {
    if (err.stderr?.includes('already exists') || err.message?.includes('already exists')) {
      console.log(`⏳ ${label} already exists (detected from error), checking again...`);
      id = getId();
      if (id) {
        console.log(`✅ ${label} already exists: ${id}`);
        return id;
      }
    }
    console.error(`❌ Failed to create ${label}:`, err);
    process.exit(1);
  }
}

// ===== 1. D1 Database =====
const dbId = ensureResource(
  'kimaraye-ahanin-db',
  'd1',
  'npx wrangler d1 create kimaraye-ahanin-db',
  () => getD1DatabaseId('kimaraye-ahanin-db')
);

// ===== 2. KV Namespace =====
const kvId = ensureResource(
  'KV',
  'kv',
  'npx wrangler kv namespace create KV',
  () => getKvNamespaceId('KV')
);

// ===== 3. Update wrangler.jsonc =====
function updateWranglerConfig(type: 'd1' | 'kv', id: string): void {
  const label = type === 'd1' ? 'D1 database' : 'KV namespace';
  const placeholder = type === 'd1' ? 'YOUR_DATABASE_ID' : 'YOUR_KV_ID';
  
  const wranglerPath = path.join(process.cwd(), 'wrangler.jsonc');
  try {
    let content = fs.readFileSync(wranglerPath, 'utf8');
    content = content.replace(new RegExp(`"${placeholder}"`, 'g'), `"${id}"`);
    fs.writeFileSync(wranglerPath, content, 'utf8');
    console.log(`✅ ${label} ID updated in wrangler.jsonc: ${id}`);
  } catch (err) {
    console.error(`❌ Failed to update ${label} in wrangler.jsonc:`, err);
    process.exit(1);
  }
}

updateWranglerConfig('d1', dbId);
updateWranglerConfig('kv', kvId);

// ===== 4. Run schema on D1 =====
try {
  console.log('📊 Running schema on D1...');
  execSync('npx wrangler d1 execute kimaraye-ahanin-db --file=./database/schema.sql', { stdio: 'inherit' });
  console.log('✅ Schema executed successfully');
} catch (err) {
  console.error('❌ Failed to execute schema:', err);
  process.exit(1);
}

// ===== 5. تنظیم توکن ادمین در KV و Environment =====
try {
  const adminToken = generateToken(32);
  console.log('🔑 Generating admin token...');
  
  // ذخیره در KV
  execSync(`npx wrangler kv:key put --binding=KV "admin_token" "${adminToken}"`, { stdio: 'inherit' });
  console.log(`✅ admin_token saved in KV: ${adminToken}`);
  
  // ذخیره در Environment Variable (از طریق Wrangler secret)
  try {
    execSync(`echo "${adminToken}" | npx wrangler secret put ADMIN_TOKEN`, { stdio: 'inherit' });
    console.log('✅ ADMIN_TOKEN saved as secret');
  } catch (secretErr) {
    console.warn('⚠️ Could not save ADMIN_TOKEN as secret. Please set it manually in Cloudflare dashboard.');
  }
  
  console.log('\n🎉 Setup completed successfully!');
  console.log(`\n🔑 ADMIN_TOKEN: ${adminToken}`);
  console.log('📌 Copy this token. You will need it to log into the admin panel.');
  console.log(`👉 https://kimaraye-ahanin.workers.dev/admin?token=${adminToken}\n`);
} catch (err) {
  console.error('❌ Failed to set admin token:', err);
  console.log('⚠️ Please set admin_token in KV manually:');
  console.log(`   npx wrangler kv:key put --binding=KV "admin_token" "YOUR_SECURE_TOKEN"`);
  process.exit(1);
}
