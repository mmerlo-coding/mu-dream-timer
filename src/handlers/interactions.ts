import type {
  ButtonInteraction,
  Message,
  StringSelectMenuInteraction,
} from "discord.js";
import { getDefaultMapId } from "../services/boss-catalog.js";
import { markBossDead } from "../services/boss-service.js";
import { sendKillConfirmationToNotifyChannel } from "../services/panel-builder.js";
import { refreshDashboard } from "../services/panel-updater.js";
import { getGuildConfigOrError } from "../utils/permissions.js";
import type { MuServer } from "../types/boss.js";

function getSelectedOptionValue(message: Message, rowIndex: number) {
  const row = message.components[rowIndex];
  if (!row || row.type !== 1) return undefined;

  const select = row.components[0];
  if (!select || select.type !== 3) return undefined;

  return select.options.find((option) => option.default)?.value;
}

function parseKillCustomId(customId: string) {
  const parts = customId.split(":");

  if (parts.length >= 4) {
    return {
      bossId: parts[1],
      mapId: parts[2],
      muServer: Number(parts[3]) as MuServer,
    };
  }

  return {
    bossId: parts[1],
    mapId: getDefaultMapId(parts[1]),
    muServer: Number(parts[2]) as MuServer,
  };
}

export async function handleSelectBoss(interaction: StringSelectMenuInteraction) {
  const access = getGuildConfigOrError(interaction.guildId);
  if (!access.ok) {
    await interaction.reply({ content: access.error, ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const bossId = interaction.values[0];
  const mapId = getDefaultMapId(bossId);
  await refreshDashboard(interaction.client, interaction.guildId!, bossId, mapId);
}

export async function handleSelectMap(interaction: StringSelectMenuInteraction) {
  const access = getGuildConfigOrError(interaction.guildId);
  if (!access.ok) {
    await interaction.reply({ content: access.error, ephemeral: true });
    return;
  }

  const bossId = interaction.customId.split(":")[1];
  if (!bossId) {
    await interaction.reply({
      content: "Primero selecciona un boss en el menú superior.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  const mapId = interaction.values[0];
  await refreshDashboard(interaction.client, interaction.guildId!, bossId, mapId);
}

export async function handleKillBoss(interaction: ButtonInteraction) {
  const { bossId, mapId, muServer } = parseKillCustomId(interaction.customId);

  if (bossId === "none" || mapId === "none") {
    await interaction.reply({
      content: "Primero selecciona un boss y un mapa en los menús desplegables.",
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

  const result = markBossDead(interaction.guildId!, muServer, bossId, mapId);

  if (!result) {
    await interaction.followUp({ content: "Boss o mapa no encontrado.", ephemeral: true });
    return;
  }

  await sendKillConfirmationToNotifyChannel(
    interaction.client,
    interaction.guildId!,
    access.config.notifyChannelId,
    result.boss.id,
    result.boss.image,
    result.boss.name,
    result.mapName,
    muServer,
    result.nextSpawnAt,
    interaction.user.toString(),
  );

  await refreshDashboard(interaction.client, interaction.guildId!, bossId, mapId);
}

export async function handleRefreshDashboard(interaction: ButtonInteraction) {
  const access = getGuildConfigOrError(interaction.guildId);
  if (!access.ok) {
    await interaction.reply({ content: access.error, ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const selectedBossId = getSelectedOptionValue(interaction.message, 0);
  const mapRow = interaction.message.components[1];
  const selectedMapId =
    mapRow?.type === 1 && mapRow.components[0]?.type === 3
      ? mapRow.components[0].options.find((option) => option.default)?.value
      : undefined;

  await refreshDashboard(
    interaction.client,
    interaction.guildId!,
    selectedBossId,
    selectedMapId,
  );
}

export function registerInteractionHandlers(client: import("discord.js").Client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isStringSelectMenu() && interaction.customId === "select_boss") {
        await handleSelectBoss(interaction);
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith("select_map")) {
        await handleSelectMap(interaction);
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
