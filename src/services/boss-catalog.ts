import bossesData from "../../config/bosses.json" with { type: "json" };
import type { Boss, BossMap } from "../types/boss.js";

const bosses = bossesData as Boss[];
const bossMap = new Map(bosses.map((boss) => [boss.id, boss]));

export function getAllBosses() {
  return bosses;
}

export function getBossById(bossId: string) {
  return bossMap.get(bossId);
}

export function getBossMaps(boss: Boss): BossMap[] {
  return boss.maps;
}

export function getBossMap(bossId: string, mapId: string) {
  const boss = getBossById(bossId);
  if (!boss) return null;

  return boss.maps.find((map) => map.id === mapId) ?? null;
}

export function getDefaultMapId(bossId: string) {
  const boss = getBossById(bossId);
  return boss?.maps[0]?.id ?? "default";
}
