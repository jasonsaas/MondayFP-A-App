import { randomUUID } from "node:crypto";
import { relations } from "drizzle-orm";
import {
    pgTable,
    text,
    timestamp,
    jsonb,
} from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";

const now = () => new Date();

export const mondayIntegrations = pgTable("monday_integrations", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => randomUUID()),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    mondayAccountId: text("monday_account_id").notNull(),
    mondayUserId: text("monday_user_id").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scopes: text("scopes"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .$defaultFn(now)
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .$defaultFn(now)
        .notNull(),
});

export const varianceConfigs = pgTable("variance_configs", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => randomUUID()),
    integrationId: text("integration_id")
        .notNull()
        .references(() => mondayIntegrations.id, { onDelete: "cascade" }),
    boardId: text("board_id").notNull(),
    actualColumnId: text("actual_column_id").notNull(),
    forecastColumnId: text("forecast_column_id").notNull(),
    varianceColumnId: text("variance_column_id"),
    settings: jsonb("settings"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .$defaultFn(now)
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .$defaultFn(now)
        .notNull(),
});

export const syncLogs = pgTable("sync_logs", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => randomUUID()),
    configId: text("config_id")
        .notNull()
        .references(() => varianceConfigs.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    details: jsonb("details"),
    errorMessage: text("error_message"),
    syncedAt: timestamp("synced_at", { withTimezone: true })
        .$defaultFn(now)
        .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .$defaultFn(now)
        .notNull(),
});

export const mondayIntegrationsRelations = relations(mondayIntegrations, ({ many }) => ({
    varianceConfigs: many(varianceConfigs),
}));

export const varianceConfigsRelations = relations(varianceConfigs, ({ one, many }) => ({
    integration: one(mondayIntegrations, {
        fields: [varianceConfigs.integrationId],
        references: [mondayIntegrations.id],
    }),
    syncLogs: many(syncLogs),
}));

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
    config: one(varianceConfigs, {
        fields: [syncLogs.configId],
        references: [varianceConfigs.id],
    }),
}));
