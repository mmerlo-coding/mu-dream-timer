import bossesData from "../../config/bosses.json" with { type: "json" };
import type { Boss } from "../types/boss.js";

const bosses = bossesData as Boss[];
const bossMap = new Map(bosses.map((boss) => [boss.id, boss]));

export function getAllBosses() {
  return bosses;
}

export function getBossById(bossId: string) {
  return bossMap.get(bossId);
}
