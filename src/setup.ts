// src/setup.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🛠️  Running setup script...');

// ===== 1. D1 Database =====
let dbId: string | null = null;
try {
  const output = execSync('npx wrangler d1 list', { encoding: 'utf8' });
  const match = output.match(/([a-f0-9-]+)\s+kimaraye-ahanin-db/);
  if (match) {
    dbId = match[1];
    console.log(`✅ D1 database already exists: ${dbId}`);
  } else {
    console.log('📦 Creating D1 database...');
    const createOutput = execSync('npx wrangler d1 create kimaraye-ahanin-db', { encoding: 'utf8' });
    const idMatch = createOutput.match(/database_id\s*=\s*"([a-f0-9-]+)"/);
    dbId = idMatch?.[1] || null;
    console.log(`✅ D1 database created: ${dbId}`);
  }
} catch (err) {
  console.error('❌ Failed to handle D1 database:', err);
  process.exit(1);
}

if (!dbId) {
  console.error('❌ Could not get D1 database ID');
  process.exit(1);
}

// ===== 2. KV Namespace (با چک کردن وجود) =====
let kvId: string | null = null;
try {
  // اول لیست namespaceها رو می‌گیریم
  const output = execSync('npx wrangler kv namespace list', { encoding: 'utf8' });
  // چک می‌کنیم که KV وجود داره یا نه
  const match = output.match(/([a-f0-9-]+)\s+KV/);
  if (match) {
    kvId = match[1];
    console.log(`✅ KV namespace already exists: ${kvId}`);
  } else {
    // اگر وجود نداشت، می‌سازیمش
    console.log('📦 Creating KV namespace...');
    const createOutput = execSync('npx wrangler kv namespace create KV', { encoding: 'utf8' });
    const idMatch = createOutput.match(/id\s*=\s*"([a-f0-9-]+)"/);
    kvId = idMatch?.[1] || null;
    console.log(`✅ KV namespace created: ${kvId}`);
  }
} catch (err) {
  console.error('❌ Failed to handle KV namespace:', err);
  process.exit(1);
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
