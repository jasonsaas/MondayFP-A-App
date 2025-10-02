-- FP&A Platform Initial Database Schema Migration
-- Generated: 2025-10-01
-- Description: Complete database schema for Monday.com FP&A application with QuickBooks integration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE subscription_tier AS ENUM ('trial', 'starter', 'professional', 'enterprise');
CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE sync_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense', 'other');
CREATE TYPE variance_severity AS ENUM ('normal', 'warning', 'critical');
CREATE TYPE insight_type AS ENUM ('variance', 'trend', 'anomaly', 'recommendation');

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  monday_account_id INTEGER UNIQUE NOT NULL,
  monday_account_name VARCHAR(255),
  monday_access_token TEXT NOT NULL,
  monday_refresh_token TEXT,
  monday_token_expires_at TIMESTAMP,
  quickbooks_realm_id VARCHAR(255) UNIQUE,
  quickbooks_access_token TEXT,
  quickbooks_refresh_token TEXT,
  quickbooks_token_expires_at TIMESTAMP,
  subscription_tier subscription_tier DEFAULT 'trial' NOT NULL,
  subscription_status VARCHAR(50) DEFAULT 'active',
  trial_ends_at TIMESTAMP,
  billing_email VARCHAR(255),
  settings JSONB DEFAULT '{"syncFrequency":"hourly","defaultCurrency":"USD","thresholds":{"warning":10,"critical":15},"notifications":{"email":true,"slack":false,"monday":true},"fiscalYearStart":1}'::jsonb,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for organizations
CREATE INDEX org_monday_account_idx ON organizations(monday_account_id);
CREATE INDEX org_qb_realm_idx ON organizations(quickbooks_realm_id);
CREATE INDEX org_active_idx ON organizations(active);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  monday_user_id INTEGER NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar VARCHAR(500),
  role user_role DEFAULT 'viewer' NOT NULL,
  last_login_at TIMESTAMP,
  preferences JSONB DEFAULT '{"theme":"auto","notifications":true,"emailDigest":"weekly"}'::jsonb,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for users
CREATE UNIQUE INDEX user_org_monday_idx ON users(organization_id, monday_user_id);
CREATE INDEX user_email_idx ON users(email);
CREATE INDEX user_org_idx ON users(organization_id);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for sessions
CREATE INDEX session_user_idx ON sessions(user_id);
CREATE INDEX session_token_idx ON sessions(token);
CREATE INDEX session_expires_idx ON sessions(expires_at);

-- Variance Analyses table
CREATE TABLE variance_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  monday_board_id INTEGER NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  period_label VARCHAR(50) NOT NULL,
  total_budget DECIMAL(15, 2),
  total_actual DECIMAL(15, 2),
  total_variance DECIMAL(15, 2),
  total_variance_percent DECIMAL(8, 4),
  critical_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  normal_count INTEGER DEFAULT 0,
  results JSONB,
  metadata JSONB,
  triggered_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for variance_analyses
CREATE INDEX va_org_board_period_idx ON variance_analyses(organization_id, monday_board_id, period_label);
CREATE INDEX va_org_idx ON variance_analyses(organization_id);
CREATE INDEX va_period_idx ON variance_analyses(period_start, period_end);
CREATE INDEX va_created_idx ON variance_analyses(created_at);

-- Budget Items table
CREATE TABLE budget_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  monday_board_id INTEGER NOT NULL,
  monday_item_id VARCHAR(255) NOT NULL,
  monday_group_id VARCHAR(255),
  account_code VARCHAR(100),
  account_name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  parent_account_code VARCHAR(100),
  amount DECIMAL(15, 2) NOT NULL,
  period VARCHAR(50) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
  notes TEXT,
  tags JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for budget_items
CREATE UNIQUE INDEX budget_org_board_item_idx ON budget_items(organization_id, monday_board_id, monday_item_id, period);
CREATE INDEX budget_org_period_idx ON budget_items(organization_id, period);
CREATE INDEX budget_account_code_idx ON budget_items(account_code);
CREATE INDEX budget_period_range_idx ON budget_items(period_start, period_end);

-- Actual Items table
CREATE TABLE actual_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quickbooks_account_id VARCHAR(255) NOT NULL,
  account_code VARCHAR(100),
  account_name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  account_sub_type VARCHAR(100),
  parent_account_id VARCHAR(255),
  parent_account_code VARCHAR(100),
  amount DECIMAL(15, 2) NOT NULL,
  period VARCHAR(50) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  transaction_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for actual_items
CREATE UNIQUE INDEX actual_org_qb_period_idx ON actual_items(organization_id, quickbooks_account_id, period);
CREATE INDEX actual_org_period_idx ON actual_items(organization_id, period);
CREATE INDEX actual_account_code_idx ON actual_items(account_code);
CREATE INDEX actual_period_range_idx ON actual_items(period_start, period_end);
CREATE INDEX actual_report_type_idx ON actual_items(report_type);

-- Sync Logs table
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL,
  status sync_status NOT NULL,
  source VARCHAR(100),
  triggered_by UUID REFERENCES users(id),
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration INTEGER,
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  error_stack TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for sync_logs
CREATE INDEX sync_org_type_status_idx ON sync_logs(organization_id, sync_type, status);
CREATE INDEX sync_status_idx ON sync_logs(status);
CREATE INDEX sync_started_idx ON sync_logs(started_at);
CREATE INDEX sync_created_idx ON sync_logs(created_at);

-- Insights table
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  variance_analysis_id UUID REFERENCES variance_analyses(id) ON DELETE CASCADE,
  insight_type insight_type NOT NULL,
  severity variance_severity NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  account_code VARCHAR(100),
  account_name VARCHAR(255),
  affected_amount DECIMAL(15, 2),
  confidence DECIMAL(5, 4),
  priority INTEGER DEFAULT 50,
  actionable BOOLEAN DEFAULT false,
  recommendation TEXT,
  metadata JSONB,
  dismissed_by UUID REFERENCES users(id),
  dismissed_at TIMESTAMP,
  dismiss_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for insights
CREATE INDEX insight_org_severity_idx ON insights(organization_id, severity);
CREATE INDEX insight_va_idx ON insights(variance_analysis_id);
CREATE INDEX insight_type_idx ON insights(insight_type);
CREATE INDEX insight_dismissed_idx ON insights(dismissed_at);
CREATE INDEX insight_created_idx ON insights(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_items_updated_at
  BEFORE UPDATE ON budget_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_actual_items_updated_at
  BEFORE UPDATE ON actual_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE organizations IS 'Organizations linked to Monday.com accounts with QuickBooks OAuth credentials';
COMMENT ON TABLE users IS 'Users belonging to organizations, mapped from Monday.com users';
COMMENT ON TABLE sessions IS 'User session tokens for authentication';
COMMENT ON TABLE variance_analyses IS 'Stored variance analysis results comparing budget vs actual';
COMMENT ON TABLE budget_items IS 'Budget data imported from Monday.com boards';
COMMENT ON TABLE actual_items IS 'Actual financial data synced from QuickBooks P&L and Balance Sheet';
COMMENT ON TABLE sync_logs IS 'Audit log of all data synchronization operations';
COMMENT ON TABLE insights IS 'AI-generated insights and recommendations based on variance analysis';

-- Add column comments
COMMENT ON COLUMN organizations.settings IS 'JSON configuration: syncFrequency, thresholds, notifications, fiscalYearStart';
COMMENT ON COLUMN variance_analyses.results IS 'Complete variance calculation results including hierarchical account tree';
COMMENT ON COLUMN variance_analyses.metadata IS 'Calculation metadata: processing time, cache status, version';
COMMENT ON COLUMN budget_items.metadata IS 'Monday.com column values and sync metadata';
COMMENT ON COLUMN actual_items.metadata IS 'QuickBooks data and sync job information';
COMMENT ON COLUMN sync_logs.metadata IS 'Sync job details: boardId, realmId, filters, retry count';
COMMENT ON COLUMN insights.metadata IS 'Additional context: trend data, related insights, variance details';
