import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { BossState, GuildConfig } from "../types/boss.js";
import { resolveFromRoot } from "../utils/paths.js";

const dataDir = resolveFromRoot("data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "timers-bot.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    notify_channel_id TEXT NOT NULL,
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

type GuildConfigRow = {
  guild_id: string;
  notify_channel_id: string;
  dashboard_message_id: string | null;
};

type BossStateRow = {
  guild_id: string;
  mu_server: number;
  boss_id: string;
  killed_at: number | null;
  next_spawn_at: number;
  notified_for_spawn_at: number | null;
};

function mapGuildConfig(row: GuildConfigRow): GuildConfig {
  return {
    guildId: row.guild_id,
    notifyChannelId: row.notify_channel_id,
    dashboardMessageId: row.dashboard_message_id,
  };
}

function mapBossState(row: BossStateRow): BossState {
  return {
    guildId: row.guild_id,
    muServer: row.mu_server,
    bossId: row.boss_id,
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
      dashboard_message_id
    ) VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      notify_channel_id = excluded.notify_channel_id,
      dashboard_message_id = COALESCE(excluded.dashboard_message_id, guild_config.dashboard_message_id)
  `).run(config.guildId, config.notifyChannelId, config.dashboardMessageId);
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
      killed_at,
      next_spawn_at,
      notified_for_spawn_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, mu_server, boss_id) DO UPDATE SET
      killed_at = excluded.killed_at,
      next_spawn_at = excluded.next_spawn_at,
      notified_for_spawn_at = excluded.notified_for_spawn_at
  `).run(
    state.guildId,
    state.muServer,
    state.bossId,
    state.killedAt,
    state.nextSpawnAt,
    state.notifiedForSpawnAt,
  );
}

export function getBossState(guildId: string, muServer: number, bossId: string) {
  const row = db
    .prepare(`
      SELECT * FROM boss_state
      WHERE guild_id = ? AND mu_server = ? AND boss_id = ?
    `)
    .get(guildId, muServer, bossId) as BossStateRow | undefined;

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
  nextSpawnAt: number,
) {
  db.prepare(`
    UPDATE boss_state
    SET notified_for_spawn_at = ?
    WHERE guild_id = ? AND mu_server = ? AND boss_id = ?
  `).run(nextSpawnAt, guildId, muServer, bossId);
}
