import type { Client } from "discord.js";
import { MU_SERVERS, type MuServer } from "../types/boss.js";
import { getGuildConfig } from "./database.js";
import { getAllBossStatuses } from "./boss-service.js";
import {
  editDashboardMessage,
  type DashboardEntry,
} from "./panel-builder.js";

function getAllDashboardEntries(guildId: string, now = new Date()): DashboardEntry[] {
  const entries: DashboardEntry[] = [];

  for (const muServer of MU_SERVERS) {
    const statuses = getAllBossStatuses(guildId, muServer, now);
    for (const status of statuses) {
      entries.push({ ...status, muServer: muServer as MuServer });
    }
  }

  return entries;
}

export async function refreshDashboard(
  client: Client,
  guildId: string,
  selectedBossId?: string,
  selectedMapId?: string,
) {
  const config = getGuildConfig(guildId);
  if (!config?.dashboardMessageId) return;

  const channel = await client.channels.fetch(config.dashboardChannelId).catch(() => null);
  if (!channel?.isSendable()) return;

  const message = await channel.messages.fetch(config.dashboardMessageId).catch(() => null);
  if (!message) return;

  const entries = getAllDashboardEntries(guildId);
  await editDashboardMessage(message, entries, selectedBossId, selectedMapId);
}

export async function refreshAllDashboards(client: Client) {
  const { getAllGuildConfigs } = await import("./database.js");
  const configs = getAllGuildConfigs();

  for (const config of configs) {
    if (!config.dashboardMessageId) continue;
    await refreshDashboard(client, config.guildId);
  }
}

export function startDashboardRefreshScheduler(client: Client) {
  const tick = () => {
    refreshAllDashboards(client).catch((error) => {
      console.error("Dashboard refresh failed:", error);
    });
  };

  tick();
  return setInterval(tick, 60_000);
}

export { getAllDashboardEntries };
