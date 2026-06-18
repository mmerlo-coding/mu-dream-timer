import type { Client } from "discord.js";
import {
  getGuildConfig,
  setDashboardMessage,
  upsertGuildConfig,
} from "./database.js";
import { sendDashboardMessage } from "./panel-builder.js";
import { getAllDashboardEntries } from "./panel-updater.js";

export async function bootstrapDashboard(client: Client) {
  const guildId = process.env.DISCORD_GUILD_ID;
  const channelId = process.env.NOTIFY_CHANNEL_ID;

  if (!guildId || !channelId) {
    console.warn(
      "NOTIFY_CHANNEL_ID o DISCORD_GUILD_ID no configurados. El panel no se publicará automáticamente.",
    );
    return;
  }

  upsertGuildConfig({
    guildId,
    notifyChannelId: channelId,
    dashboardMessageId: null,
  });

  const existing = getGuildConfig(guildId);
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel?.isSendable()) {
    throw new Error(`No se pudo acceder al canal ${channelId}`);
  }

  if (existing?.dashboardMessageId) {
    const message = await channel.messages.fetch(existing.dashboardMessageId).catch(() => null);
    if (message) {
      console.log("Dashboard existente encontrado, reutilizando.");
      return;
    }
  }

  const entries = getAllDashboardEntries(guildId);
  const dashboardMessage = await sendDashboardMessage(channel, entries);

  upsertGuildConfig({
    guildId,
    notifyChannelId: channelId,
    dashboardMessageId: dashboardMessage.id,
  });

  setDashboardMessage(guildId, dashboardMessage.id);
  console.log(`Dashboard publicado en canal ${channelId}`);
}
