// src/setup.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🛠️  Running setup script...');

// ===== 1. D1 Database =====
let dbId: string | null = null;
try {
  // استفاده از 'd1 get' برای دریافت مستقیم اطلاعات دیتابیس
  const output = execSync('npx wrangler d1 get kimaraye-ahanin-db', { encoding: 'utf8' });
  const match = output.match(/"uuid"\s*:\s*"([a-f0-9-]+)"/);
  if (match) {
    dbId = match[1];
    console.log(`✅ D1 database already exists: ${dbId}`);
  } else {
    throw new Error('Could not parse D1 info');
  }
} catch (err) {
  // اگر دیتابیس وجود نداشت، بسازش
  console.log('📦 Creating D1 database...');
  try {
    const createOutput = execSync('npx wrangler d1 create kimaraye-ahanin-db', { encoding: 'utf8' });
    const idMatch = createOutput.match(/database_id\s*=\s*"([a-f0-9-]+)"/);
    dbId = idMatch?.[1] || null;
    console.log(`✅ D1 database created: ${dbId}`);
  } catch (createErr) {
    console.error('❌ Failed to create D1 database:', createErr);
    process.exit(1);
  }
}

if (!dbId) {
  console.error('❌ Could not get D1 database ID');
  process.exit(1);
}

// ===== 2. KV Namespace =====
let kvId: string | null = null;
try {
  const output = execSync('npx wrangler kv namespace list', { encoding: 'utf8' });
  // regex برای پیدا کردن ID از جدول خروجی
  const match = output.match(/([a-f0-9-]+)\s+KV/);
  if (match) {
    kvId = match[1];
    console.log(`✅ KV namespace already exists: ${kvId}`);
  } else {
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
