import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { markBossDead } from "../services/boss-service.js";
import { sendKillConfirmationToNotifyChannel } from "../services/panel-builder.js";
import { refreshDashboard } from "../services/panel-updater.js";
import { getGuildConfigOrError } from "../utils/permissions.js";
import type { MuServer } from "../types/boss.js";

export async function handleSelectBoss(interaction: StringSelectMenuInteraction) {
  const access = getGuildConfigOrError(interaction.guildId);
  if (!access.ok) {
    await interaction.reply({ content: access.error, ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const bossId = interaction.values[0];
  await refreshDashboard(interaction.client, interaction.guildId!, bossId);
}

export async function handleKillBoss(interaction: ButtonInteraction) {
  const [, bossId, muServerText] = interaction.customId.split(":");

  if (bossId === "none") {
    await interaction.reply({
      content: "Primero selecciona un boss en el menú desplegable.",
      ephemeral: true,
    });
    return;
  }

  const access = getGuildConfigOrError(interaction.guildId);
  if (!access.ok) {
    await interaction.reply({ content: access.error, ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const muServer = Number(muServerText) as MuServer;
  const result = markBossDead(interaction.guildId!, muServer, bossId);

  if (!result) {
    await interaction.followUp({ content: "Boss no encontrado.", ephemeral: true });
    return;
  }

  await sendKillConfirmationToNotifyChannel(
    interaction.client,
    interaction.guildId!,
    access.config.notifyChannelId,
    result.boss.id,
    result.boss.image,
    result.boss.name,
    muServer,
    result.nextSpawnAt,
    interaction.user.toString(),
  );

  await refreshDashboard(interaction.client, interaction.guildId!);
}

export async function handleRefreshDashboard(interaction: ButtonInteraction) {
  const access = getGuildConfigOrError(interaction.guildId);
  if (!access.ok) {
    await interaction.reply({ content: access.error, ephemeral: true });
    return;
  }

  await interaction.deferUpdate();
  await refreshDashboard(interaction.client, interaction.guildId!);
}

export function registerInteractionHandlers(client: import("discord.js").Client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isStringSelectMenu() && interaction.customId === "select_boss") {
        await handleSelectBoss(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith("kill:")) {
        await handleKillBoss(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId === "refresh_dashboard") {
        await handleRefreshDashboard(interaction);
      }
    } catch (error) {
      console.error("Interaction handler failed:", error);

      if (interaction.isRepliable()) {
        const content = "Ocurrió un error al procesar la acción.";
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content }).catch(() =>
            interaction.followUp({ content, ephemeral: true }).catch(() => undefined),
          );
        } else {
          await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
        }
      }
    }
  });
}
