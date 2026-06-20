import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { BossState, GuildConfig } from "../types/boss.js";
import { getDefaultMapId } from "./boss-catalog.js";
import { resolveFromRoot } from "../utils/paths.js";

const dataDir = resolveFromRoot("data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "timers-bot.db"));

function getTableColumns(tableName: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  return rows.map((row) => row.name);
}

function migrateGuildConfigSchema() {
  const columns = getTableColumns("guild_config");

  if (columns.length === 0) return;

  if (columns.includes("dashboard_message_id")) return;

  db.exec(`
    CREATE TABLE guild_config_new (
      guild_id TEXT PRIMARY KEY,
      notify_channel_id TEXT NOT NULL,
      dashboard_message_id TEXT
    );

    INSERT INTO guild_config_new (guild_id, notify_channel_id, dashboard_message_id)
    SELECT
      guild_id,
      MAX(notify_channel_id),
      MAX(panel_message_id)
    FROM guild_config
    GROUP BY guild_id;

    DROP TABLE guild_config;
    ALTER TABLE guild_config_new RENAME TO guild_config;
  `);
}

migrateGuildConfigSchema();

function migrateDashboardChannelColumn() {
  const columns = getTableColumns("guild_config");
  if (columns.length === 0) return;
  if (columns.includes("dashboard_channel_id")) return;

  db.exec(`ALTER TABLE guild_config ADD COLUMN dashboard_channel_id TEXT`);
  db.exec(`
    UPDATE guild_config
    SET dashboard_channel_id = notify_channel_id
    WHERE dashboard_channel_id IS NULL
  `);
}

migrateDashboardChannelColumn();

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    notify_channel_id TEXT NOT NULL,
    dashboard_channel_id TEXT,
    dashboard_message_id TEXT
  );

  CREATE TABLE IF NOT EXISTS boss_state (
    guild_id TEXT NOT NULL,
    mu_server INTEGER NOT NULL,
    boss_id TEXT NOT NULL,
    killed_at INTEGER,
    next_spawn_at INTEGER NOT NULL,
    notified_for_spawn_at INTEGER,
    PRIMARY KEY (guild_id, mu_server, boss_id)
  );
`);

function migrateBossStateMapColumn() {
  const columns = getTableColumns("boss_state");
  if (columns.length === 0) return;
  if (columns.includes("map_id")) return;

  db.exec(`
    CREATE TABLE boss_state_new (
      guild_id TEXT NOT NULL,
      mu_server INTEGER NOT NULL,
      boss_id TEXT NOT NULL,
      map_id TEXT NOT NULL,
      killed_at INTEGER,
      next_spawn_at INTEGER NOT NULL,
      notified_for_spawn_at INTEGER,
      PRIMARY KEY (guild_id, mu_server, boss_id, map_id)
    );
  `);

  const oldRows = db.prepare(`SELECT * FROM boss_state`).all() as BossStateRow[];

  const insert = db.prepare(`
    INSERT INTO boss_state_new (
      guild_id,
      mu_server,
      boss_id,
      map_id,
      killed_at,
      next_spawn_at,
      notified_for_spawn_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of oldRows) {
    insert.run(
      row.guild_id,
      row.mu_server,
      row.boss_id,
      getDefaultMapId(row.boss_id),
      row.killed_at,
      row.next_spawn_at,
      row.notified_for_spawn_at,
    );
  }

  db.exec(`DROP TABLE boss_state`);
  db.exec(`ALTER TABLE boss_state_new RENAME TO boss_state`);
}

migrateBossStateMapColumn();

type GuildConfigRow = {
  guild_id: string;
  notify_channel_id: string;
  dashboard_channel_id: string | null;
  dashboard_message_id: string | null;
};

type BossStateRow = {
  guild_id: string;
  mu_server: number;
  boss_id: string;
  map_id?: string;
  killed_at: number | null;
  next_spawn_at: number;
  notified_for_spawn_at: number | null;
};

function mapGuildConfig(row: GuildConfigRow): GuildConfig {
  return {
    guildId: row.guild_id,
    notifyChannelId: row.notify_channel_id,
    dashboardChannelId: row.dashboard_channel_id ?? row.notify_channel_id,
    dashboardMessageId: row.dashboard_message_id,
  };
}

function mapBossState(row: BossStateRow): BossState {
  return {
    guildId: row.guild_id,
    muServer: row.mu_server,
    bossId: row.boss_id,
    mapId: row.map_id ?? getDefaultMapId(row.boss_id),
    killedAt: row.killed_at,
    nextSpawnAt: row.next_spawn_at,
    notifiedForSpawnAt: row.notified_for_spawn_at,
  };
}

export function upsertGuildConfig(config: GuildConfig) {
  db.prepare(`
    INSERT INTO guild_config (
      guild_id,
      notify_channel_id,
      dashboard_channel_id,
      dashboard_message_id
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      notify_channel_id = excluded.notify_channel_id,
      dashboard_channel_id = excluded.dashboard_channel_id,
      dashboard_message_id = COALESCE(excluded.dashboard_message_id, guild_config.dashboard_message_id)
  `).run(
    config.guildId,
    config.notifyChannelId,
    config.dashboardChannelId,
    config.dashboardMessageId,
  );
}

export function getGuildConfig(guildId: string) {
  const row = db
    .prepare(`SELECT * FROM guild_config WHERE guild_id = ?`)
    .get(guildId) as GuildConfigRow | undefined;

  return row ? mapGuildConfig(row) : null;
}

export function getAllGuildConfigs() {
  const rows = db.prepare(`SELECT * FROM guild_config`).all() as GuildConfigRow[];
  return rows.map(mapGuildConfig);
}

export function setDashboardMessage(guildId: string, dashboardMessageId: string) {
  db.prepare(`
    UPDATE guild_config
    SET dashboard_message_id = ?
    WHERE guild_id = ?
  `).run(dashboardMessageId, guildId);
}

export function upsertBossState(state: BossState) {
  db.prepare(`
    INSERT INTO boss_state (
      guild_id,
      mu_server,
      boss_id,
      map_id,
      killed_at,
      next_spawn_at,
      notified_for_spawn_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, mu_server, boss_id, map_id) DO UPDATE SET
      killed_at = excluded.killed_at,
      next_spawn_at = excluded.next_spawn_at,
      notified_for_spawn_at = excluded.notified_for_spawn_at
  `).run(
    state.guildId,
    state.muServer,
    state.bossId,
    state.mapId,
    state.killedAt,
    state.nextSpawnAt,
    state.notifiedForSpawnAt,
  );
}

export function getBossState(
  guildId: string,
  muServer: number,
  bossId: string,
  mapId: string,
) {
  const row = db
    .prepare(`
      SELECT * FROM boss_state
      WHERE guild_id = ? AND mu_server = ? AND boss_id = ? AND map_id = ?
    `)
    .get(guildId, muServer, bossId, mapId) as BossStateRow | undefined;

  return row ? mapBossState(row) : null;
}

export function getBossStatesForGuild(guildId: string, muServer: number) {
  const rows = db
    .prepare(`
      SELECT * FROM boss_state
      WHERE guild_id = ? AND mu_server = ?
    `)
    .all(guildId, muServer) as BossStateRow[];

  return rows.map(mapBossState);
}

export function markNotified(
  guildId: string,
  muServer: number,
  bossId: string,
  mapId: string,
  nextSpawnAt: number,
) {
  db.prepare(`
    UPDATE boss_state
    SET notified_for_spawn_at = ?
    WHERE guild_id = ? AND mu_server = ? AND boss_id = ? AND map_id = ?
  `).run(nextSpawnAt, guildId, muServer, bossId, mapId);
}

export function clearAllBossStates(guildId: string) {
  db.prepare(`DELETE FROM boss_state WHERE guild_id = ?`).run(guildId);
}

export function countBossStates(guildId: string) {
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM boss_state WHERE guild_id = ?`)
    .get(guildId) as { count: number };

  return row.count;
}
