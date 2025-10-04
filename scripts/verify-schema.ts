/**
 * Schema Verification Script
 *
 * Verifies that all required database tables exist
 * Run this with production DATABASE_URL to ensure schema is ready
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function verifySchema() {
  console.log('🔍 Verifying database schema...\n');

  const tables = [
    'organizations',
    'users',
    'monday_integrations',
    'quickbooks_integrations',
    'variance_snapshots',
    'sync_logs',
  ];

  let allTablesExist = true;

  for (const tableName of tables) {
    try {
      await db.execute(sql.raw(`SELECT COUNT(*) FROM ${tableName}`));
      console.log(`✓ ${tableName} table exists`);
    } catch (error: any) {
      console.error(`✗ ${tableName} table missing:`, error.message);
      allTablesExist = false;
    }
  }

  console.log('\n');

  if (allTablesExist) {
    console.log('✅ All required tables verified!\n');
    console.log('Your database schema is ready for production.\n');
  } else {
    console.error('❌ Schema verification failed!\n');
    console.log('To create missing tables, run:');
    console.log('  npm run db:push\n');
    process.exit(1);
  }
}

verifySchema().catch((error) => {
  console.error('❌ Verification error:', error);
  process.exit(1);
});
