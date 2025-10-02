#!/usr/bin/env tsx

/**
 * Setup Verification Script
 *
 * Checks that all required components are configured correctly
 * Run with: npx tsx scripts/verify-setup.ts
 */

import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
config({ path: '.env.local' });

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, message: string, isWarning = false) {
  results.push({
    name,
    status: condition ? 'pass' : (isWarning ? 'warning' : 'fail'),
    message: condition ? `✓ ${message}` : `✗ ${message}`,
  });
}

console.log('\n🔍 Verifying Monday.com Marketplace App Setup...\n');

// Check environment variables
check(
  'Database URL',
  !!process.env.DATABASE_URL,
  'DATABASE_URL is configured',
);

check(
  'JWT Secret',
  !!process.env.JWT_SECRET && process.env.JWT_SECRET.length > 20,
  'JWT_SECRET is set and secure',
);

check(
  'Monday Client ID',
  !!process.env.MONDAY_CLIENT_ID,
  'MONDAY_CLIENT_ID is configured',
);

check(
  'Monday Client Secret',
  !!process.env.MONDAY_CLIENT_SECRET,
  'MONDAY_CLIENT_SECRET is configured',
);

check(
  'QuickBooks Client ID',
  !!process.env.QUICKBOOKS_CLIENT_ID,
  'QUICKBOOKS_CLIENT_ID is configured',
);

check(
  'QuickBooks Client Secret',
  !!process.env.QUICKBOOKS_CLIENT_SECRET,
  'QUICKBOOKS_CLIENT_SECRET is configured',
);

check(
  'Next Public URL',
  !!process.env.NEXT_PUBLIC_URL,
  'NEXT_PUBLIC_URL is configured',
);

// Check critical files
check(
  'Monday Manifest',
  existsSync('monday-code.json'),
  'monday-code.json manifest exists',
);

check(
  'Database Schema',
  existsSync('lib/db/schema.ts'),
  'Database schema file exists',
);

check(
  'Monday View Component',
  existsSync('app/monday-view/page.tsx'),
  'Monday board view component exists',
);

check(
  'Monday Widget Component',
  existsSync('app/monday-widget/page.tsx'),
  'Monday dashboard widget exists',
);

// Check API routes
const apiRoutes = [
  'app/api/auth/monday/route.ts',
  'app/api/auth/monday/callback/route.ts',
  'app/api/auth/quickbooks/route.ts',
  'app/api/auth/quickbooks/callback/route.ts',
  'app/api/variance/analyze/route.ts',
  'app/api/variance/summary/route.ts',
  'app/api/quickbooks/sync/route.ts',
];

apiRoutes.forEach(route => {
  check(
    `API Route: ${route}`,
    existsSync(route),
    `${route} exists`,
    true
  );
});

// Check package.json dependencies
const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
const deps = packageJson.dependencies;

check(
  'Next.js',
  !!deps.next,
  `Next.js installed (${deps.next})`,
);

check(
  'Drizzle ORM',
  !!deps['drizzle-orm'],
  `Drizzle ORM installed (${deps['drizzle-orm']})`,
);

check(
  'Intuit OAuth',
  !!deps['intuit-oauth'],
  `Intuit OAuth installed (${deps['intuit-oauth']})`,
);

check(
  'Monday SDK',
  !!deps['monday-sdk-js'],
  `Monday SDK installed (${deps['monday-sdk-js']})`,
  true
);

// Print results
console.log('\n📋 Results:\n');

const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;
const warnings = results.filter(r => r.status === 'warning').length;

results.forEach(result => {
  const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
  console.log(`${icon} ${result.message}`);
});

console.log('\n📊 Summary:\n');
console.log(`✅ Passed: ${passed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📦 Total: ${results.length}\n`);

if (failed > 0) {
  console.log('❌ Setup incomplete. Please fix the failed checks above.\n');
  console.log('💡 Quick fixes:');
  console.log('   - Copy .env.example to .env.local and fill in values');
  console.log('   - Run: npm install');
  console.log('   - Run: npm run db:push\n');
  process.exit(1);
}

if (warnings > 0) {
  console.log('⚠️  Setup mostly complete, but some optional components are missing.\n');
}

console.log('✅ Setup verification complete! Your app is ready to run.\n');
console.log('🚀 Next steps:');
console.log('   1. npm run db:dev     # Start PostgreSQL');
console.log('   2. npm run db:push    # Push schema to database');
console.log('   3. npm run dev        # Start development server');
console.log('   4. Visit http://localhost:3000\n');

process.exit(0);
