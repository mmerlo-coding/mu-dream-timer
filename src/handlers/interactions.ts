import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { getGuildConfig } from "../services/database.js";
import { markBossDead } from "../services/boss-service.js";
import {
  buildBossAttachment,
  buildKillConfirmationEmbed,
} from "../services/panel-builder.js";
import { refreshDashboard } from "../services/panel-updater.js";
import type { MuServer } from "../types/boss.js";

async function ensureConfigured(interaction: ButtonInteraction | StringSelectMenuInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "Este bot solo funciona dentro de un servidor.",
      ephemeral: true,
    });
    return false;
  }

  const config = getGuildConfig(interaction.guildId);
  if (!config) {
    await interaction.reply({
      content: "El bot aún no está configurado. Revisa NOTIFY_CHANNEL_ID y DISCORD_GUILD_ID.",
      ephemeral: true,
    });
    return false;
  }

  return true;
}

export async function handleSelectBoss(interaction: StringSelectMenuInteraction) {
  if (!(await ensureConfigured(interaction))) return;

  const bossId = interaction.values[0];
  await interaction.deferUpdate();
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

  if (!(await ensureConfigured(interaction))) return;

  const muServer = Number(muServerText) as MuServer;
  const result = markBossDead(interaction.guildId!, muServer, bossId);

  if (!result) {
    await interaction.reply({ content: "Boss no encontrado.", ephemeral: true });
    return;
  }

  const embed = buildKillConfirmationEmbed(
    result.boss.name,
    muServer,
    result.nextSpawnAt,
  );
  const files = result.boss.image
    ? [buildBossAttachment(result.boss.id, result.boss.image)]
    : [];

  if (files.length > 0) {
    embed.setThumbnail(`attachment://${result.boss.id}.png`);
  }

  await interaction.reply({
    embeds: [embed],
    files,
    ephemeral: true,
  });

  await refreshDashboard(interaction.client, interaction.guildId!);
}

export async function handleRefreshDashboard(interaction: ButtonInteraction) {
  if (!(await ensureConfigured(interaction))) return;

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
          await interaction.followUp({ content, ephemeral: true }).catch(() => undefined);
        } else {
          await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
        }
      }
    }
  });
}
