import fs from "node:fs";
import type { Boss } from "../types/boss.js";
import { resolveFromRoot } from "../utils/paths.js";
import { getBossById, getAllBosses } from "./boss-catalog.js";
import {
  getBossState,
  getBossStatesForGuild,
  upsertBossState,
} from "./database.js";
import { getNextSpawnAt } from "./spawn-calculator.js";

export type BossStatus = {
  boss: Boss;
  killedAt: Date | null;
  nextSpawnAt: Date | null;
};

export function getBossImagePath(boss: Boss) {
  return resolveFromRoot(boss.image);
}

export function bossImageExists(boss: Boss) {
  return fs.existsSync(getBossImagePath(boss));
}

export function getBossStatus(
  guildId: string,
  muServer: number,
  bossId: string,
  now = new Date(),
): BossStatus | null {
  const boss = getBossById(bossId);
  if (!boss) return null;

  const stored = getBossState(guildId, muServer, bossId);
  const killedAt = stored?.killedAt ? new Date(stored.killedAt) : null;
  const nextSpawnAt = getNextSpawnAt(boss, killedAt, now);

  return {
    boss,
    killedAt,
    nextSpawnAt,
  };
}

export function getAllBossStatuses(
  guildId: string,
  muServer: number,
  now = new Date(),
): BossStatus[] {
  const storedStates = new Map(
    getBossStatesForGuild(guildId, muServer).map((state) => [state.bossId, state]),
  );

  return getAllBosses().map((boss) => {
    const stored = storedStates.get(boss.id);
    const killedAt = stored?.killedAt ? new Date(stored.killedAt) : null;
    const nextSpawnAt = getNextSpawnAt(boss, killedAt, now);

    return {
      boss,
      killedAt,
      nextSpawnAt,
    };
  });
}

export function markBossDead(
  guildId: string,
  muServer: number,
  bossId: string,
  killedAt = new Date(),
) {
  const boss = getBossById(bossId);
  if (!boss) return null;

  const nextSpawnAt = getNextSpawnAt(boss, killedAt, killedAt);
  if (!nextSpawnAt) return null;

  upsertBossState({
    guildId,
    muServer,
    bossId,
    killedAt: killedAt.getTime(),
    nextSpawnAt: nextSpawnAt.getTime(),
    notifiedForSpawnAt: null,
  });

  return {
    boss,
    killedAt,
    nextSpawnAt,
  };
}

export function syncFixedBossStates(
  guildId: string,
  muServer: number,
  now = new Date(),
) {
  for (const boss of getAllBosses()) {
    if (boss.spawnMode.type !== "fixedTimes") continue;

    const stored = getBossState(guildId, muServer, boss.id);
    const killedAt = stored?.killedAt ? new Date(stored.killedAt) : null;
    const nextSpawnAt = getNextSpawnAt(boss, killedAt, now);

    if (!nextSpawnAt) continue;

    const shouldUpdate =
      !stored ||
      stored.nextSpawnAt !== nextSpawnAt.getTime() ||
      (stored.notifiedForSpawnAt !== null &&
        stored.notifiedForSpawnAt !== nextSpawnAt.getTime() &&
        nextSpawnAt.getTime() <= now.getTime());

    if (shouldUpdate && (!stored || stored.nextSpawnAt !== nextSpawnAt.getTime())) {
      upsertBossState({
        guildId,
        muServer,
        bossId: boss.id,
        killedAt: stored?.killedAt ?? null,
        nextSpawnAt: nextSpawnAt.getTime(),
        notifiedForSpawnAt:
          stored?.notifiedForSpawnAt === nextSpawnAt.getTime()
            ? stored.notifiedForSpawnAt
            : null,
      });
    }
  }
}

export function getUpcomingBosses(
  guildId: string,
  muServer: number,
  now = new Date(),
) {
  return getAllBossStatuses(guildId, muServer, now)
    .filter((status) => status.nextSpawnAt)
    .sort(
      (left, right) =>
        (left.nextSpawnAt?.getTime() ?? 0) - (right.nextSpawnAt?.getTime() ?? 0),
    );
}
