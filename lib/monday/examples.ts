/**
 * Monday.com Integration Examples
 *
 * Practical examples demonstrating Monday integration usage
 */

import {
  MondayClient,
  ColumnMapper,
  MondayVarianceIntegration,
  runMondayVarianceIntegration,
} from './index';

/**
 * Example 1: Basic Board Reading
 */
export async function example1_readBoard() {
  console.log('=== Example 1: Read Monday Board ===\n');

  const client = new MondayClient({
    apiKey: process.env.MONDAY_API_KEY!,
  });

  // Get board data
  const board = await client.getBoard('123456789');

  console.log(`Board: ${board.name}`);
  console.log(`Columns: ${board.columns.length}`);
  console.log(`Items: ${board.items_page?.items.length || 0}`);

  // List all columns
  console.log('\nColumns:');
  board.columns.forEach((col) => {
    console.log(`  - ${col.title} (${col.type})`);
  });

  return board;
}

/**
 * Example 2: Auto-Detect Budget Columns
 */
export async function example2_detectColumns() {
  console.log('=== Example 2: Auto-Detect Columns ===\n');

  const client = new MondayClient({
    apiKey: process.env.MONDAY_API_KEY!,
  });

  const board = await client.getBoard('123456789');

  // Auto-detect columns
  const mapper = new ColumnMapper(board.columns);
  const mapping = mapper.detectColumns();

  console.log('Detected Columns:');
  console.log(`  Budget: ${mapping.budgetColumn || 'NOT FOUND'}`);
  console.log(`  Actual: ${mapping.actualColumn || 'NOT FOUND'}`);
  console.log(`  Variance: ${mapping.varianceColumn || 'NOT FOUND'}`);
  console.log(`  Severity: ${mapping.severityColumn || 'NOT FOUND'}`);

  // Get detailed detection with confidence scores
  const detailed = mapper.getDetailedDetection();
  console.log('\nDetailed Detection:');
  detailed.forEach((d) => {
    console.log(
      `  - ${d.purpose}: "${d.title}" (${d.confidence} confidence)`
    );
  });

  // Validate mapping
  const validation = mapper.validateMapping(mapping);
  console.log('\nValidation:');
  console.log(`  Valid: ${validation.valid}`);
  if (validation.errors.length > 0) {
    console.log('  Errors:', validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.log('  Warnings:', validation.warnings);
  }

  return mapping;
}

/**
 * Example 3: Create Variance Columns
 */
export async function example3_createVarianceColumns() {
  console.log('=== Example 3: Create Variance Columns ===\n');

  const client = new MondayClient({
    apiKey: process.env.MONDAY_API_KEY!,
  });

  const boardId = '123456789';
  const board = await client.getBoard(boardId);

  console.log('Creating variance columns...');

  const columns = await client.createVarianceColumns(boardId, board.columns);

  console.log('✓ Created columns:');
  console.log(`  - Variance ($): ${columns.varianceColumn.id}`);
  console.log(`  - Variance (%): ${columns.variancePercentColumn.id}`);
  console.log(`  - Severity: ${columns.severityColumn.id}`);

  return columns;
}

/**
 * Example 4: Update Board Items
 */
export async function example4_updateItems() {
  console.log('=== Example 4: Update Board Items ===\n');

  const client = new MondayClient({
    apiKey: process.env.MONDAY_API_KEY!,
  });

  const boardId = '123456789';
  const itemId = '987654321';

  // Update variance columns
  console.log(`Updating item ${itemId}...`);

  await client.updateItemColumns(itemId, boardId, {
    variance_dollar: '5000',
    variance_percent: '20',
    severity: JSON.stringify({ label: '0' }), // Critical
  });

  console.log('✓ Item updated successfully');
}

/**
 * Example 5: Batch Update Multiple Items
 */
export async function example5_batchUpdate() {
  console.log('=== Example 5: Batch Update Items ===\n');

  const client = new MondayClient({
    apiKey: process.env.MONDAY_API_KEY!,
  });

  const boardId = '123456789';

  // Prepare batch updates
  const updates = [
    {
      itemId: '111',
      columnValues: {
        variance_dollar: '2000',
        variance_percent: '10',
        severity: JSON.stringify({ label: '1' }), // Warning
      },
    },
    {
      itemId: '222',
      columnValues: {
        variance_dollar: '-500',
        variance_percent: '-5',
        severity: JSON.stringify({ label: '3' }), // Favorable
      },
    },
    {
      itemId: '333',
      columnValues: {
        variance_dollar: '8000',
        variance_percent: '25',
        severity: JSON.stringify({ label: '0' }), // Critical
      },
    },
  ];

  console.log(`Batch updating ${updates.length} items...`);

  await client.batchUpdateItems(boardId, updates);

  console.log('✓ Batch update complete');
}

/**
 * Example 6: Complete Variance Integration
 */
export async function example6_varianceIntegration() {
  console.log('=== Example 6: Complete Variance Integration ===\n');

  const result = await runMondayVarianceIntegration({
    mondayApiKey: process.env.MONDAY_API_KEY!,
    organizationId: 'org-123',
    boardId: '123456789',
    period: '2024-01',
    autoDetectColumns: true,
    createMissingColumns: true,
    writeBackResults: true,
  });

  console.log('\nResults:');
  console.log(`  Total Variance: $${result.totalVariance.toLocaleString()}`);
  console.log(`  Variance %: ${result.totalVariancePercent.toFixed(2)}%`);
  console.log(`  Critical Count: ${result.summary.criticalCount}`);
  console.log(`  Warning Count: ${result.summary.warningCount}`);
  console.log(`  Insights Generated: ${result.insights.length}`);

  return result;
}

/**
 * Example 7: Setup Webhook
 */
export async function example7_setupWebhook() {
  console.log('=== Example 7: Setup Webhook ===\n');

  const client = new MondayClient({
    apiKey: process.env.MONDAY_API_KEY!,
  });

  const boardId = '123456789';
  const webhookUrl = 'https://your-app.com/api/webhooks/monday';

  console.log(`Creating webhook for board ${boardId}...`);

  const webhook = await client.createWebhook(
    boardId,
    webhookUrl,
    'change_column_value'
  );

  console.log('✓ Webhook created:');
  console.log(`  ID: ${webhook.id}`);
  console.log(`  URL: ${webhook.url}`);

  return webhook;
}

/**
 * Example 8: Handle Rate Limits
 */
export async function example8_rateLimiting() {
  console.log('=== Example 8: Rate Limiting Example ===\n');

  const client = new MondayClient({
    apiKey: process.env.MONDAY_API_KEY!,
    retryAttempts: 3,
    retryDelay: 1000,
  });

  const boardId = '123456789';

  // Get all items (handles pagination automatically)
  console.log('Fetching all board items...');
  const items = await client.getAllBoardItems(boardId);

  console.log(`✓ Retrieved ${items.length} items`);

  // Batch update with automatic rate limiting
  console.log('\nPreparing large batch update...');

  const updates = items.slice(0, 100).map((item, index) => ({
    itemId: item.id,
    columnValues: {
      test_column: `Updated ${index + 1}`,
    },
  }));

  console.log(`Updating ${updates.length} items with rate limiting...`);

  await client.batchUpdateItems(boardId, updates);

  console.log('✓ Batch update complete (rate limits handled automatically)');
}

/**
 * Example 9: Custom Column Mapping
 */
export async function example9_customMapping() {
  console.log('=== Example 9: Custom Column Mapping ===\n');

  const integration = new MondayVarianceIntegration({
    mondayApiKey: process.env.MONDAY_API_KEY!,
    organizationId: 'org-123',
    boardId: '123456789',
    period: '2024-01',
    autoDetectColumns: false, // Disable auto-detection
    columnMapping: {
      budgetColumn: 'numbers_1',
      actualColumn: 'numbers_2',
      varianceColumn: 'numbers_3',
      variancePercentColumn: 'numbers_4',
      severityColumn: 'status_1',
      accountTypeColumn: 'dropdown_1',
      periodColumn: 'date_1',
    },
  });

  console.log('Running variance analysis with custom mapping...');

  const result = await integration.performVarianceAnalysis();

  console.log('✓ Analysis complete');
  console.log(`  Total Variance: $${result.totalVariance.toLocaleString()}`);

  return result;
}

/**
 * Example 10: Error Handling
 */
export async function example10_errorHandling() {
  console.log('=== Example 10: Error Handling ===\n');

  const client = new MondayClient({
    apiKey: process.env.MONDAY_API_KEY!,
    retryAttempts: 3,
    timeout: 10000,
  });

  try {
    // Try to get non-existent board
    console.log('Attempting to get non-existent board...');
    await client.getBoard('999999999');
  } catch (error: any) {
    console.log('✓ Error caught:');
    console.log(`  Message: ${error.message}`);
    console.log(`  Status Code: ${error.statusCode || 'N/A'}`);
    console.log(`  Error Code: ${error.errorCode || 'N/A'}`);
    console.log(`  Retryable: ${error.retryable || false}`);
  }

  try {
    // Try invalid column update
    console.log('\nAttempting invalid column update...');
    await client.updateItemColumns('123', '456', {
      invalid_column: 'test',
    });
  } catch (error: any) {
    console.log('✓ Error caught:');
    console.log(`  Message: ${error.message}`);
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 Running Monday.com Integration Examples\n');
  console.log('=' .repeat(60));

  try {
    // Run safe examples only (reading, not writing)
    // await example1_readBoard();
    // console.log('\n' + '='.repeat(60) + '\n');

    // await example2_detectColumns();
    // console.log('\n' + '='.repeat(60) + '\n');

    // Uncomment to run write examples:
    // await example3_createVarianceColumns();
    // await example4_updateItems();
    // await example5_batchUpdate();
    // await example6_varianceIntegration();
    // await example7_setupWebhook();
    // await example9_customMapping();

    await example10_errorHandling();

    console.log('\n✅ Examples completed!');
  } catch (error) {
    console.error('\n❌ Example failed:', error);
  }
}

// Run examples if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
