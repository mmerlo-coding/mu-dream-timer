import type { Client } from "discord.js";
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
  buildNotificationEmbed,
  buildNotificationKillButtons,
} from "./panel-builder.js";
import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import { NOTIFY_MINUTES } from "../utils/time.js";
import { MU_SERVERS } from "../types/boss.js";

function shouldNotify(status: BossStatus, now: Date) {
  if (!status.nextSpawnAt) return false;

  const remainingMs = status.nextSpawnAt.getTime() - now.getTime();
  return remainingMs > 0 && remainingMs <= NOTIFY_MINUTES * 60_000;
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

        const stored = getBossState(
          config.guildId,
          muServer,
          status.boss.id,
          status.mapId,
        );
        const nextSpawnAt = status.nextSpawnAt?.getTime();

        if (!nextSpawnAt) continue;
        if (stored?.notifiedForSpawnAt === nextSpawnAt) continue;

        const embed = buildNotificationEmbed(status, muServer, now);
        const files = status.boss.image
          ? [buildBossAttachment(status.boss.id, status.boss.image)]
          : [];

        if (files.length > 0) {
          embed.setImage(`attachment://${status.boss.id}.png`);
        }

        const killButtons = buildNotificationKillButtons(status.boss.id, status.mapId);
        const components = [
          new ActionRowBuilder<ButtonBuilder>().addComponents(...killButtons),
        ];

        await channel.send({ embeds: [embed], files, components });

        upsertBossState({
          guildId: config.guildId,
          muServer,
          bossId: status.boss.id,
          mapId: status.mapId,
          killedAt: stored?.killedAt ?? null,
          nextSpawnAt,
          notifiedForSpawnAt: nextSpawnAt,
        });

        markNotified(
          config.guildId,
          muServer,
          status.boss.id,
          status.mapId,
          nextSpawnAt,
        );
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
