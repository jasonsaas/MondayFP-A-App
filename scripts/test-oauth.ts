/**
 * OAuth Flow Testing Script
 *
 * This script tests the complete OAuth flow for Monday.com and QuickBooks integrations.
 * Use this to verify OAuth configuration before deploying to production.
 *
 * Usage:
 *   npm run test:oauth monday
 *   npm run test:oauth quickbooks
 *   npm run test:oauth all
 */

import { createServer } from 'http';
import { parse } from 'url';
import open from 'open';

// Configuration
const PORT = 3001;
const MONDAY_AUTH_URL = 'https://auth.monday.com/oauth2/authorize';
const QUICKBOOKS_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  authUrl: string;
  tokenUrl: string;
}

const mondayConfig: OAuthConfig = {
  clientId: process.env.MONDAY_CLIENT_ID || '',
  clientSecret: process.env.MONDAY_CLIENT_SECRET || '',
  redirectUri: process.env.MONDAY_REDIRECT_URI || `http://localhost:${PORT}/callback/monday`,
  scope: 'me:read boards:read boards:write workspaces:read account:read',
  authUrl: MONDAY_AUTH_URL,
  tokenUrl: 'https://auth.monday.com/oauth2/token',
};

const quickbooksConfig: OAuthConfig = {
  clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || `http://localhost:${PORT}/callback/quickbooks`,
  scope: 'com.intuit.quickbooks.accounting',
  authUrl: QUICKBOOKS_AUTH_URL,
  tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateConfig(config: OAuthConfig, provider: string): boolean {
  log(`\n🔍 Validating ${provider} OAuth Configuration...`, 'cyan');

  const errors: string[] = [];

  if (!config.clientId) {
    errors.push(`❌ Missing ${provider}_CLIENT_ID in environment variables`);
  } else {
    log(`✅ Client ID: ${config.clientId.substring(0, 10)}...`, 'green');
  }

  if (!config.clientSecret) {
    errors.push(`❌ Missing ${provider}_CLIENT_SECRET in environment variables`);
  } else {
    log(`✅ Client Secret: ${config.clientSecret.substring(0, 10)}...`, 'green');
  }

  if (!config.redirectUri) {
    errors.push(`❌ Missing ${provider}_REDIRECT_URI in environment variables`);
  } else {
    log(`✅ Redirect URI: ${config.redirectUri}`, 'green');
  }

  if (errors.length > 0) {
    log('\n❌ Configuration Errors:', 'red');
    errors.forEach((error) => log(error, 'red'));
    return false;
  }

  log('✅ Configuration valid!', 'green');
  return true;
}

function generateAuthUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state: state,
    response_type: 'code',
  });

  return `${config.authUrl}?${params.toString()}`;
}

async function exchangeCodeForToken(
  code: string,
  config: OAuthConfig
): Promise<any> {
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: config.redirectUri,
  });

  const authHeader = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString('base64');

  log('\n🔄 Exchanging authorization code for access token...', 'cyan');

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`,
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Token exchange failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    log(`❌ Token exchange error: ${error}`, 'red');
    throw error;
  }
}

async function testMondayToken(accessToken: string): Promise<void> {
  log('\n🔍 Testing Monday.com API access...', 'cyan');

  try {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken,
      },
      body: JSON.stringify({
        query: 'query { me { id name email account { id name } } }',
      }),
    });

    if (!response.ok) {
      throw new Error(
        `API test failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.errors) {
      log('❌ API returned errors:', 'red');
      console.log(JSON.stringify(data.errors, null, 2));
      return;
    }

    log('✅ Monday.com API access successful!', 'green');
    log('\nUser Info:', 'cyan');
    console.log(JSON.stringify(data.data.me, null, 2));
  } catch (error) {
    log(`❌ API test error: ${error}`, 'red');
    throw error;
  }
}

async function testQuickBooksToken(
  accessToken: string,
  realmId: string
): Promise<void> {
  log('\n🔍 Testing QuickBooks API access...', 'cyan');

  const baseUrl =
    process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

  try {
    const response = await fetch(
      `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `API test failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    log('✅ QuickBooks API access successful!', 'green');
    log('\nCompany Info:', 'cyan');
    console.log(JSON.stringify(data.CompanyInfo, null, 2));
  } catch (error) {
    log(`❌ API test error: ${error}`, 'red');
    throw error;
  }
}

function startOAuthServer(
  config: OAuthConfig,
  provider: 'monday' | 'quickbooks'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const state = Math.random().toString(36).substring(7);
    const authUrl = generateAuthUrl(config, state);

    log(`\n🚀 Starting OAuth test server on port ${PORT}...`, 'bright');
    log(`\n📋 Authorization URL:`, 'cyan');
    log(authUrl, 'blue');

    const server = createServer(async (req, res) => {
      const parsedUrl = parse(req.url || '', true);

      if (parsedUrl.pathname === `/callback/${provider}`) {
        const { code, state: returnedState, realmId } = parsedUrl.query;

        // Validate state parameter
        if (returnedState !== state) {
          log('❌ State mismatch - possible CSRF attack!', 'red');
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error: State mismatch</h1>');
          server.close();
          reject(new Error('State mismatch'));
          return;
        }

        if (!code) {
          log('❌ No authorization code received', 'red');
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error: No authorization code</h1>');
          server.close();
          reject(new Error('No authorization code'));
          return;
        }

        log('✅ Authorization code received!', 'green');
        log(`Code: ${String(code).substring(0, 20)}...`, 'blue');

        try {
          // Exchange code for token
          const tokenData = await exchangeCodeForToken(String(code), config);

          log('✅ Access token received!', 'green');
          log(`Token: ${tokenData.access_token.substring(0, 20)}...`, 'blue');

          // Test the token
          if (provider === 'monday') {
            await testMondayToken(tokenData.access_token);
          } else if (provider === 'quickbooks') {
            await testQuickBooksToken(
              tokenData.access_token,
              String(realmId || '')
            );
          }

          // Success response
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>OAuth Success</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
                  .success { color: #4CAF50; font-size: 24px; }
                  .details { margin-top: 20px; padding: 20px; background: #f5f5f5; border-radius: 5px; }
                  pre { text-align: left; }
                </style>
              </head>
              <body>
                <h1 class="success">✅ OAuth Flow Successful!</h1>
                <p>You can close this window and check the terminal for details.</p>
                <div class="details">
                  <h3>Token Details:</h3>
                  <pre>${JSON.stringify(tokenData, null, 2)}</pre>
                </div>
              </body>
            </html>
          `);

          log('\n✅ OAuth flow completed successfully!', 'green');
          log('\n📝 Token Details:', 'cyan');
          console.log(JSON.stringify(tokenData, null, 2));

          setTimeout(() => {
            server.close();
            resolve();
          }, 1000);
        } catch (error) {
          log(`\n❌ OAuth flow failed: ${error}`, 'red');
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<h1>Error: ${error}</h1>`);
          server.close();
          reject(error);
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      log(`\n✅ Server listening on http://localhost:${PORT}`, 'green');
      log('\n🌐 Opening authorization URL in browser...', 'yellow');

      // Open browser
      open(authUrl).catch((error) => {
        log(`\n⚠️  Could not open browser automatically: ${error}`, 'yellow');
        log('\n📋 Please manually open this URL in your browser:', 'cyan');
        log(authUrl, 'blue');
      });
    });

    server.on('error', (error) => {
      log(`\n❌ Server error: ${error}`, 'red');
      reject(error);
    });
  });
}

async function testOAuthFlow(provider: 'monday' | 'quickbooks' | 'all') {
  log('\n╔════════════════════════════════════════════════╗', 'bright');
  log('║     FP&A Platform - OAuth Flow Tester         ║', 'bright');
  log('╚════════════════════════════════════════════════╝\n', 'bright');

  if (provider === 'all') {
    // Test Monday.com
    if (validateConfig(mondayConfig, 'MONDAY')) {
      try {
        await startOAuthServer(mondayConfig, 'monday');
      } catch (error) {
        log(`\n❌ Monday.com OAuth test failed: ${error}`, 'red');
      }
    }

    // Test QuickBooks
    if (validateConfig(quickbooksConfig, 'QUICKBOOKS')) {
      try {
        await startOAuthServer(quickbooksConfig, 'quickbooks');
      } catch (error) {
        log(`\n❌ QuickBooks OAuth test failed: ${error}`, 'red');
      }
    }
  } else if (provider === 'monday') {
    if (validateConfig(mondayConfig, 'MONDAY')) {
      await startOAuthServer(mondayConfig, 'monday');
    }
  } else if (provider === 'quickbooks') {
    if (validateConfig(quickbooksConfig, 'QUICKBOOKS')) {
      await startOAuthServer(quickbooksConfig, 'quickbooks');
    }
  }
}

// Run the test
const provider = (process.argv[2] as 'monday' | 'quickbooks' | 'all') || 'all';

testOAuthFlow(provider)
  .then(() => {
    log('\n✅ OAuth testing completed!', 'green');
    process.exit(0);
  })
  .catch((error) => {
    log(`\n❌ OAuth testing failed: ${error}`, 'red');
    process.exit(1);
  });
