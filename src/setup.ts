// src/setup.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🛠️  Running setup script...');

// ===== 1. D1 Database via Cloudflare API =====
let dbId: string | null = null;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '6fc555b82a923d29d57511d1f1245299';
const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';

try {
  // اول با API چک می‌کنیم که دیتابیس وجود داره یا نه
  const listResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  const listData = await listResponse.json();
  
  if (listData.success && listData.result) {
    const existing = listData.result.find((db: any) => db.name === 'kimaraye-ahanin-db');
    if (existing) {
      dbId = existing.uuid;
      console.log(`✅ D1 database already exists: ${dbId}`);
    }
  }
} catch (err) {
  console.log('⚠️ Could not check via API, falling back to wrangler...');
}

// اگر از طریق API پیدا نشد، با wrangler بسازش
if (!dbId) {
  console.log('📦 Creating D1 database via wrangler...');
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
