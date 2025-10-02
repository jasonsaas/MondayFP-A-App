# Scripts Directory

Utility scripts for development, testing, and deployment.

## Available Scripts

### 🧪 test-oauth.ts

**Purpose**: Test OAuth flows for Monday.com and QuickBooks integrations.

**Usage**:
```bash
# Test Monday.com OAuth
npm run test:oauth monday

# Test QuickBooks OAuth
npm run test:oauth quickbooks

# Test both providers
npm run test:oauth all
```

**What it does**:
1. Starts a local OAuth server on port 3001
2. Opens your browser to the authorization page
3. Handles the OAuth callback
4. Exchanges authorization code for access token
5. Tests API access with the token
6. Displays full token details

**Requirements**:
- Valid OAuth credentials in `.env.local`
- Port 3001 available
- Browser access

**Output**:
```
✅ OAuth flow completed successfully!

📝 Token Details:
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

---

### 🌱 seed-demo-data.ts

**Purpose**: Create realistic demo data for sales demonstrations.

**Usage**:
```bash
# Seed demo data
npm run seed:demo

# Clean existing demo data and reseed
npm run seed:demo -- --clean

# Load specific scenario
npm run seed:demo -- --scenario=1
```

**Available Scenarios**:

1. **TechForward SaaS** (Scenario 1)
   - Fast-growing SaaS company
   - Revenue 11.2% over budget
   - Marketing 17.5% over budget (critical)
   - Infrastructure 6.1% under budget
   - 3 AI insights generated

2. **StyleHub E-commerce** (Scenario 2 - Coming soon)
   - E-commerce with inventory challenges
   - Seasonal revenue fluctuations

3. **Innovate Consulting** (Scenario 3 - Coming soon)
   - Professional services firm
   - High utilization rates

**What it creates**:
- Demo organization with realistic name
- 3 users (admin, CFO, controller)
- 6 budget items
- 6 actual items
- 1 variance analysis
- 3 AI insights (critical/warning/normal)
- 3 sync logs

**Output**:
```
📊 Demo Data Summary:
Organization: TechForward Inc.
Monday Account ID: 99999001
QuickBooks Realm ID: 9999900100000001

💰 Key Metrics:
  • Total Revenue: $1,113,000 (11.3% over budget)
  • Total Expenses: $886,700 (5.2% over budget)
  • Net Variance: $145,700 favorable
  • Critical Issues: 1 (Marketing overspend)
```

**Demo Talking Points**:
1. Show SaaS revenue outperformance (+11.2%)
2. Highlight marketing overspend alert (-17.5%)
3. Demonstrate infrastructure cost savings
4. Walk through AI-generated insights
5. Show real-time Monday.com sync

---

### ✅ verify-setup.ts

**Purpose**: Verify development environment setup.

**Usage**:
```bash
npm run verify
```

**What it checks**:
- Node.js version
- Environment variables
- Database connection
- Redis connection (if configured)
- Required packages
- File permissions

---

## Adding Package.json Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "test:oauth": "tsx scripts/test-oauth.ts",
    "seed:demo": "tsx scripts/seed-demo-data.ts",
    "seed:demo:clean": "tsx scripts/seed-demo-data.ts --clean"
  }
}
```

## Dependencies

All scripts require:
- `tsx` - TypeScript execution
- `dotenv` - Environment variable loading

OAuth testing requires:
- `open` - Browser automation

Install with:
```bash
npm install -D tsx dotenv open
```

## Development Tips

### Running Scripts Directly

```bash
# With tsx
npx tsx scripts/test-oauth.ts monday

# With ts-node
npx ts-node scripts/seed-demo-data.ts --clean
```

### Debugging Scripts

Enable debug output:
```bash
DEBUG=* npm run test:oauth
```

View verbose logs:
```bash
LOG_LEVEL=debug npm run seed:demo
```

## Creating New Scripts

Template for new scripts:

```typescript
/**
 * Script Name
 *
 * Description of what the script does.
 *
 * Usage:
 *   npm run script-name [args]
 */

import { config } from 'dotenv';
config();

// Color output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  try {
    log('Starting...', 'green');

    // Script logic here

    log('Complete!', 'green');
  } catch (error) {
    log(`Error: ${error}`, 'red');
    process.exit(1);
  }
}

main();
```

## Troubleshooting

### OAuth Test Fails

**Problem**: "Could not open browser"
**Solution**: Manually open the URL displayed in terminal

**Problem**: "State mismatch"
**Solution**: Clear cookies and try again

**Problem**: "Invalid credentials"
**Solution**: Verify client ID/secret in `.env.local`

### Demo Data Fails

**Problem**: "Database connection failed"
**Solution**: Check `DATABASE_URL` in `.env.local`

**Problem**: "Organization already exists"
**Solution**: Run with `--clean` flag

**Problem**: "Foreign key constraint"
**Solution**: Run database migrations first

## Best Practices

1. **Always test scripts locally** before running in production
2. **Use meaningful variable names** for clarity
3. **Add color output** for better readability
4. **Include error handling** for all async operations
5. **Document usage** in script header comments
6. **Validate environment** before running critical operations

## Script Maintenance

### Adding New Demo Scenarios

1. Add scenario to `scenarios` object in `seed-demo-data.ts`
2. Create `seedScenarioN()` function
3. Update README with scenario description
4. Test with `npm run seed:demo -- --scenario=N`

### Updating OAuth Tests

1. Add provider config to script
2. Implement test function
3. Add to main switch statement
4. Update README

---

For more information, see:
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Full deployment guide
- [DEPLOYMENT_SUMMARY.md](../DEPLOYMENT_SUMMARY.md) - Quick reference
