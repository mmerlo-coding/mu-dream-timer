import type { Client, SendableChannels } from "discord.js";
import {
  getAllGuildConfigs,
  getBossState,
  markNotified,
  upsertBossState,
} from "./database.js";
import {
  getAllBossStatuses,
  syncFixedBossStates,
  type BossStatus,
} from "./boss-service.js";
import {
  buildBossAttachment,
  buildKillButtonRows,
  buildNotificationEmbed,
  buildNotificationKillButtons,
} from "./panel-builder.js";
import { NOTIFY_MINUTES } from "../utils/time.js";
import { MU_SERVERS, type MuServer } from "../types/boss.js";

function shouldNotify(status: BossStatus, now: Date) {
  if (!status.nextSpawnAt) return false;

  const remainingMs = status.nextSpawnAt.getTime() - now.getTime();
  return remainingMs > 0 && remainingMs <= NOTIFY_MINUTES * 60_000;
}

async function notifyBossSpawn(
  channel: SendableChannels,
  guildId: string,
  muServer: MuServer,
  status: BossStatus,
  now: Date,
) {
  const stored = getBossState(guildId, muServer, status.boss.id, status.mapId);
  const nextSpawnAt = status.nextSpawnAt?.getTime();

  if (!nextSpawnAt) return;
  if (stored?.notifiedForSpawnAt === nextSpawnAt) return;

  const embed = buildNotificationEmbed(status, muServer, now);
  const files = status.boss.image
    ? [buildBossAttachment(status.boss.id, status.boss.image)]
    : [];

  if (files.length > 0) {
    embed.setImage(`attachment://${status.boss.id}.png`);
  }

  const killButtons = buildNotificationKillButtons(status.boss.id, status.mapId);
  const components = buildKillButtonRows(killButtons);

  await channel.send({ embeds: [embed], files, components });

  upsertBossState({
    guildId,
    muServer,
    bossId: status.boss.id,
    mapId: status.mapId,
    killedAt: stored?.killedAt ?? null,
    nextSpawnAt,
    notifiedForSpawnAt: nextSpawnAt,
  });

  markNotified(guildId, muServer, status.boss.id, status.mapId, nextSpawnAt);
}

export async function runNotificationCycle(client: Client) {
  const now = new Date();
  const configs = getAllGuildConfigs();

  for (const config of configs) {
    const channel = await client.channels.fetch(config.notifyChannelId).catch(() => null);
    if (!channel?.isSendable()) continue;

    for (const muServer of MU_SERVERS) {
      syncFixedBossStates(config.guildId, muServer, now);
      const statuses = getAllBossStatuses(config.guildId, muServer, now);

      for (const status of statuses) {
        if (!shouldNotify(status, now)) continue;

        // Isolate each notification: a single failed send (bad image, Discord
        // API hiccup, missing permission) must not abort the rest of the cycle.
        try {
          await notifyBossSpawn(channel, config.guildId, muServer, status, now);
        } catch (error) {
          console.error(
            `Failed to notify ${status.boss.id} (${status.mapId}) on S${muServer}:`,
            error,
          );
        }
      }
    }
  }
}

export function startNotificationScheduler(client: Client) {
  const tick = () => {
    runNotificationCycle(client).catch((error) => {
      console.error("Notification cycle failed:", error);
    });
  };

  tick();
  return setInterval(tick, 60_000);
}
