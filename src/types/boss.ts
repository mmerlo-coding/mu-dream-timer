export type AfterKillSpawnMode = {
  type: "afterKill";
  hours: number;
  minutes?: number;
};

export type AfterKillRangeSpawnMode = {
  type: "afterKillRange";
  minHours: number;
  maxHours: number;
};

export type FixedTimesSpawnMode = {
  type: "fixedTimes";
  times: string[];
};

export type SpawnMode =
  | AfterKillSpawnMode
  | AfterKillRangeSpawnMode
  | FixedTimesSpawnMode;

export type BossMap = {
  id: string;
  name: string;
};

export type Boss = {
  id: string;
  name: string;
  location: string;
  quantity: number;
  spawnMode: SpawnMode;
  image: string;
  maps: BossMap[];
};

export type GuildConfig = {
  guildId: string;
  notifyChannelId: string;
  dashboardChannelId: string;
  dashboardMessageId: string | null;
};

export type BossState = {
  guildId: string;
  muServer: number;
  bossId: string;
  mapId: string;
  killedAt: number | null;
  nextSpawnAt: number;
  notifiedForSpawnAt: number | null;
};

export const MU_SERVERS = [1, 2, 3] as const;
export type MuServer = (typeof MU_SERVERS)[number];
