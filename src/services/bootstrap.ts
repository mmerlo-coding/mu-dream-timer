import type { Client, Message } from "discord.js";
import {
  getGuildConfig,
  setDashboardMessage,
  upsertGuildConfig,
} from "./database.js";
import { sendDashboardMessage } from "./panel-builder.js";
import { getAllDashboardEntries, refreshDashboard } from "./panel-updater.js";

function resolveChannelIds() {
  const guildId = process.env.DISCORD_GUILD_ID;
  const notifyChannelId = process.env.NOTIFY_CHANNEL_ID;
  const dashboardChannelId = process.env.DASHBOARD_CHANNEL_ID ?? notifyChannelId;

  return { guildId, notifyChannelId, dashboardChannelId };
}

async function pinDashboardMessage(message: Message) {
  try {
    await message.pin();
    console.log("Panel fijado en el canal.");
  } catch {
    console.warn(
      "No se pudo fijar el panel. Dale al bot el permiso 'Fijar mensajes' en el canal del panel.",
    );
  }
}

export async function bootstrapDashboard(client: Client) {
  const { guildId, notifyChannelId, dashboardChannelId } = resolveChannelIds();

  if (!guildId || !notifyChannelId || !dashboardChannelId) {
    console.warn(
      "DISCORD_GUILD_ID y NOTIFY_CHANNEL_ID deben estar configurados en .env",
    );
    return;
  }

  if (
    !/^\d+$/.test(guildId) ||
    !/^\d+$/.test(notifyChannelId) ||
    !/^\d+$/.test(dashboardChannelId)
  ) {
    throw new Error(
      "DISCORD_GUILD_ID, NOTIFY_CHANNEL_ID y DASHBOARD_CHANNEL_ID deben ser IDs numéricos.",
    );
  }

  upsertGuildConfig({
    guildId,
    notifyChannelId,
    dashboardChannelId,
    dashboardMessageId: null,
  });

  const existing = getGuildConfig(guildId);
  const dashboardChannel = await client.channels.fetch(dashboardChannelId).catch(() => null);

  if (!dashboardChannel?.isSendable()) {
    throw new Error(
      `No se pudo acceder al canal del panel ${dashboardChannelId}. Verifica permisos del bot.`,
    );
  }

  if (existing?.dashboardMessageId) {
    const message = await dashboardChannel.messages
      .fetch(existing.dashboardMessageId)
      .catch(() => null);

    if (message) {
      await refreshDashboard(client, guildId);
      console.log(
        existing.dashboardChannelId === dashboardChannelId
          ? "Panel existente actualizado."
          : "Panel actualizado en el nuevo canal.",
      );
      return;
    }
  }

  const entries = getAllDashboardEntries(guildId);
  const dashboardMessage = await sendDashboardMessage(dashboardChannel, entries);

  upsertGuildConfig({
    guildId,
    notifyChannelId,
    dashboardChannelId,
    dashboardMessageId: dashboardMessage.id,
  });

  setDashboardMessage(guildId, dashboardMessage.id);
  await pinDashboardMessage(dashboardMessage);

  if (dashboardChannelId === notifyChannelId) {
    console.log(`Panel publicado en canal ${dashboardChannelId} (avisos en el mismo canal).`);
    return;
  }

  console.log(`Panel publicado en ${dashboardChannelId}. Avisos en ${notifyChannelId}.`);
}
