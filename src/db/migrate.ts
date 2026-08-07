import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

if (!connectionString) {
  console.error('❌ DATABASE_URL or SUPABASE_DB_URL is required');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

console.log('🚀 Running migrations...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('✅ Migrations completed');

await sql.end();
