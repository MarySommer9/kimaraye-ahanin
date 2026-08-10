import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🛠️  Running setup script...');

// 1. Check if D1 exists, create if not
let dbId: string | null = null;
try {
  const output = execSync('npx wrangler d1 list --json', { encoding: 'utf8' });
  const dbs = JSON.parse(output);
  const existing = dbs.find((db: any) => db.name === 'kimaraye-ahanin-db');
  if (existing) {
    dbId = existing.uuid;
    console.log(`✅ D1 database already exists: ${dbId}`);
  } else {
    console.log('📦 Creating D1 database...');
    const createOutput = execSync('npx wrangler d1 create kimaraye-ahanin-db', { encoding: 'utf8' });
    const match = createOutput.match(/database_id\s*=\s*"([a-f0-9-]+)"/);
    dbId = match?.[1] || null;
    console.log(`✅ D1 database created: ${dbId}`);
  }
} catch (err) {
  console.error('❌ Failed to create D1 database:', err);
  process.exit(1);
}

// 2. Check if KV exists, create if not
let kvId: string | null = null;
try {
  const output = execSync('npx wrangler kv namespace list --json', { encoding: 'utf8' });
  const namespaces = JSON.parse(output);
  const existing = namespaces.find((ns: any) => ns.title === 'KV');
  if (existing) {
    kvId = existing.id;
    console.log(`✅ KV namespace already exists: ${kvId}`);
  } else {
    console.log('📦 Creating KV namespace...');
    const createOutput = execSync('npx wrangler kv namespace create KV --json', { encoding: 'utf8' });
    const result = JSON.parse(createOutput);
    kvId = result.id;
    console.log(`✅ KV namespace created: ${kvId}`);
  }
} catch (err) {
  console.error('❌ Failed to create KV namespace:', err);
  process.exit(1);
}

// 3. Update wrangler.jsonc with real IDs
const wranglerPath = path.join(process.cwd(), 'wrangler.jsonc');
try {
  let content = fs.readFileSync(wranglerPath, 'utf8');
  // Replace placeholder IDs
  content = content.replace(/"YOUR_DATABASE_ID"/g, `"${dbId}"`);
  content = content.replace(/"YOUR_KV_ID"/g, `"${kvId}"`);
  fs.writeFileSync(wranglerPath, content, 'utf8');
  console.log('✅ wrangler.jsonc updated with real IDs');
} catch (err) {
  console.error('❌ Failed to update wrangler.jsonc:', err);
  process.exit(1);
}

// 4. Run schema on D1
try {
  console.log('📊 Running schema on D1...');
  execSync('npx wrangler d1 execute kimaraye-ahanin-db --file=./database/schema.sql', { stdio: 'inherit' });
  console.log('✅ Schema executed successfully');
} catch (err) {
  console.error('❌ Failed to execute schema:', err);
  process.exit(1);
}

console.log('🎉 Setup completed successfully!');
