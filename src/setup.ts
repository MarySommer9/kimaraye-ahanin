// src/setup.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🛠️  Running setup script...');

// ===== تابع: گرفتن ID دیتابیس D1 =====
function getD1DatabaseId(name: string): string | null {
  try {
    // تلاش با JSON
    const output = execSync(`npx wrangler d1 list --json`, { encoding: 'utf8' });
    const databases = JSON.parse(output);
    const db = databases.find((d: any) => d.name === name);
    return db?.uuid || db?.id || null;
  } catch {
    // اگر JSON کار نکرد، با regex از خروجی متن
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
function getKVNamespaceId(title: string): string | null {
  try {
    // تلاش با JSON
    const output = execSync(`npx wrangler kv namespace list --json`, { encoding: 'utf8' });
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

// ===== 1. D1 Database =====
const dbName = 'kimaraye-ahanin-db';
console.log(`🔍 Checking D1 database "${dbName}"...`);

let dbId = getD1DatabaseId(dbName);
if (dbId) {
  console.log(`✅ D1 database already exists: ${dbId}`);
} else {
  console.log('📦 Creating D1 database...');
  try {
    execSync(`npx wrangler d1 create ${dbName}`, { stdio: 'inherit' });
    // بعد از ساخت، دوباره ID رو بگیر
    dbId = getD1DatabaseId(dbName);
    if (dbId) {
      console.log(`✅ D1 database created: ${dbId}`);
    } else {
      console.error('❌ D1 database created but could not retrieve ID');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Failed to create D1 database:', err);
    process.exit(1);
  }
}

if (!dbId) {
  console.error('❌ Could not get D1 database ID');
  process.exit(1);
}

// ===== 2. KV Namespace =====
const kvTitle = 'KV';
console.log(`🔍 Checking KV namespace "${kvTitle}"...`);

let kvId = getKVNamespaceId(kvTitle);
if (kvId) {
  console.log(`✅ KV namespace already exists: ${kvId}`);
} else {
  console.log('📦 Creating KV namespace...');
  try {
    execSync(`npx wrangler kv namespace create ${kvTitle}`, { stdio: 'inherit' });
    // بعد از ساخت، دوباره ID رو بگیر
    kvId = getKVNamespaceId(kvTitle);
    if (kvId) {
      console.log(`✅ KV namespace created: ${kvId}`);
    } else {
      console.error('❌ KV namespace created but could not retrieve ID');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Failed to create KV namespace:', err);
    process.exit(1);
  }
}

if (!kvId) {
  console.error('❌ Could not get KV namespace ID');
  process.exit(1);
}

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
  execSync(`npx wrangler d1 execute ${dbName} --file=./database/schema.sql`, { stdio: 'inherit' });
  console.log('✅ Schema executed successfully');
} catch (err) {
  console.error('❌ Failed to execute schema:', err);
  process.exit(1);
}

console.log('🎉 Setup completed successfully!');
