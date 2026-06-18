import type { Boss, SpawnMode } from "../types/boss.js";
import {
  fromServerParts,
  parseTimeString,
  toServerDate,
} from "../utils/time.js";

function addHours(date: Date, hours: number, minutes = 0) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000 + minutes * 60 * 1000);
}

function getAfterKillSpawnAt(killedAt: Date, spawnMode: SpawnMode) {
  if (spawnMode.type === "afterKill") {
    return addHours(killedAt, spawnMode.hours, spawnMode.minutes ?? 0);
  }

  if (spawnMode.type === "afterKillRange") {
    return addHours(killedAt, spawnMode.minHours);
  }

  return null;
}

function getNextFixedSpawnAt(reference: Date, times: string[]) {
  const referenceParts = toServerDate(reference);
  const candidates: Date[] = [];

  for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
    const dayMs = dayOffset * 24 * 60 * 60 * 1000;
    const dayReference = new Date(reference.getTime() + dayMs);
    const dayParts = toServerDate(dayReference);

    for (const time of times) {
      const { hour, minute } = parseTimeString(time);
      candidates.push(
        fromServerParts(
          dayParts.year,
          dayParts.month,
          dayParts.day,
          hour,
          minute,
        ),
      );
    }
  }

  const next = candidates
    .filter((candidate) => candidate.getTime() >= reference.getTime())
    .sort((left, right) => left.getTime() - right.getTime())[0];

  return next ?? null;
}

export function getNextSpawnAt(boss: Boss, killedAt: Date | null, now = new Date()) {
  if (boss.spawnMode.type === "fixedTimes") {
    const reference = killedAt ?? now;
    return getNextFixedSpawnAt(reference, boss.spawnMode.times);
  }

  if (!killedAt) return null;

  return getAfterKillSpawnAt(killedAt, boss.spawnMode);
}

export function getSpawnRangeLabel(boss: Boss) {
  const { spawnMode } = boss;

  if (spawnMode.type === "afterKill") {
    return `${spawnMode.hours}h después de morir`;
  }

  if (spawnMode.type === "afterKillRange") {
    return `${spawnMode.minHours}-${spawnMode.maxHours}h después de morir`;
  }

  return spawnMode.times.join(", ");
}
