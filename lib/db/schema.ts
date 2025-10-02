import { pgTable, uuid, varchar, json, timestamp, integer, boolean, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Organizations table - one per Monday account
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  mondayAccountId: integer('monday_account_id').unique().notNull(),
  mondayAccountName: varchar('monday_account_name', { length: 255 }),
  mondayAccessToken: text('monday_access_token').notNull(),
  mondayRefreshToken: text('monday_refresh_token'),
  mondayTokenExpiresAt: timestamp('monday_token_expires_at'),
  quickbooksCompanyId: varchar('quickbooks_company_id', { length: 255 }),
  quickbooksAccessToken: text('quickbooks_access_token'),
  quickbooksRefreshToken: text('quickbooks_refresh_token'),
  subscription: varchar('subscription', { length: 50 }).default('trial'),
  trialEndsAt: timestamp('trial_ends_at'),
  settings: json('settings').$type<{
    syncFrequency: 'realtime' | '15min' | 'hourly' | 'daily';
    defaultBoardId?: string;
    defaultCurrency: 'USD' | 'EUR' | 'GBP';
    thresholds: {
      warning: number;
      critical: number;
    };
  }>().default({
    syncFrequency: 'hourly',
    defaultCurrency: 'USD',
    thresholds: { warning: 5, critical: 10 }
  }),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Users table - multiple per organization
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  mondayUserId: integer('monday_user_id').unique().notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  avatar: varchar('avatar', { length: 500 }),
  role: varchar('role', { length: 50 }).default('viewer'), // admin, editor, viewer
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Sessions table for JWT management
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Variance snapshots table
export const varianceSnapshots = pgTable('variance_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  boardId: integer('board_id').notNull(),
  period: varchar('period', { length: 20 }).notNull(), // '2025-01'
  data: json('data').$type<any>(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  varianceSnapshots: many(varianceSnapshots),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const varianceSnapshotsRelations = relations(varianceSnapshots, ({ one }) => ({
  organization: one(organizations, {
    fields: [varianceSnapshots.organizationId],
    references: [organizations.id],
  }),
}));
