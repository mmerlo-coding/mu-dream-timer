import { getGuildConfig } from "../services/database.js";

export function getGuildConfigOrError(guildId: string | null) {
  if (!guildId) {
    return { ok: false as const, error: "Este bot solo funciona dentro de un servidor." };
  }

  const config = getGuildConfig(guildId);
  if (!config) {
    return {
      ok: false as const,
      error: "El bot aún no está configurado. Revisa NOTIFY_CHANNEL_ID y DISCORD_GUILD_ID.",
    };
  }

  return { ok: true as const, config };
}
