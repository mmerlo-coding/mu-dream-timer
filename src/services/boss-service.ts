import type { Boss } from "../types/boss.js";
import { getAllBosses, getBossById, getBossMap } from "./boss-catalog.js";
import {
  getBossState,
  getBossStatesForGuild,
  upsertBossState,
} from "./database.js";
import { getNextSpawnAt } from "./spawn-calculator.js";

export type BossStatus = {
  boss: Boss;
  mapId: string;
  mapName: string;
  killedAt: Date | null;
  nextSpawnAt: Date | null;
};

function buildStatus(
  boss: Boss,
  mapId: string,
  mapName: string,
  killedAt: Date | null,
  now: Date,
): BossStatus {
  return {
    boss,
    mapId,
    mapName,
    killedAt,
    nextSpawnAt: getNextSpawnAt(boss, killedAt, now),
  };
}

export function getBossStatus(
  guildId: string,
  muServer: number,
  bossId: string,
  mapId: string,
  now = new Date(),
): BossStatus | null {
  const boss = getBossById(bossId);
  const map = getBossMap(bossId, mapId);
  if (!boss || !map) return null;

  const stored = getBossState(guildId, muServer, bossId, mapId);
  const killedAt = stored?.killedAt ? new Date(stored.killedAt) : null;

  return buildStatus(boss, mapId, map.name, killedAt, now);
}

export function getAllBossStatuses(
  guildId: string,
  muServer: number,
  now = new Date(),
): BossStatus[] {
  const storedStates = new Map(
    getBossStatesForGuild(guildId, muServer).map(
      (state) => [`${state.bossId}:${state.mapId}`, state],
    ),
  );

  const statuses: BossStatus[] = [];

  for (const boss of getAllBosses()) {
    for (const map of boss.maps) {
      const stored = storedStates.get(`${boss.id}:${map.id}`);
      const killedAt = stored?.killedAt ? new Date(stored.killedAt) : null;
      statuses.push(buildStatus(boss, map.id, map.name, killedAt, now));
    }
  }

  return statuses;
}

export function markBossDead(
  guildId: string,
  muServer: number,
  bossId: string,
  mapId: string,
  killedAt = new Date(),
) {
  const boss = getBossById(bossId);
  const map = getBossMap(bossId, mapId);
  if (!boss || !map) return null;

  const nextSpawnAt = getNextSpawnAt(boss, killedAt, killedAt);
  if (!nextSpawnAt) return null;

  upsertBossState({
    guildId,
    muServer,
    bossId,
    mapId,
    killedAt: killedAt.getTime(),
    nextSpawnAt: nextSpawnAt.getTime(),
    notifiedForSpawnAt: null,
  });

  return {
    boss,
    mapId,
    mapName: map.name,
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

    for (const map of boss.maps) {
      const stored = getBossState(guildId, muServer, boss.id, map.id);
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
          mapId: map.id,
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
