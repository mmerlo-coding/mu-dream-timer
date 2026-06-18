import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type Message,
  type SendableChannels,
} from "discord.js";
import { getAllBosses } from "./boss-catalog.js";
import type { BossStatus } from "./boss-service.js";
import { getSpawnRangeLabel } from "./spawn-calculator.js";
import { formatDuration, formatServerDateTime } from "../utils/time.js";
import { resolveFromRoot } from "../utils/paths.js";
import type { MuServer } from "../types/boss.js";

export type DashboardEntry = BossStatus & { muServer: MuServer };

function buildUpcomingLine(entry: DashboardEntry, now: Date) {
  if (!entry.nextSpawnAt) return null;

  const remainingMs = entry.nextSpawnAt.getTime() - now.getTime();
  const remainingLabel =
    remainingMs <= 0 ? "disponible" : formatDuration(remainingMs);

  return `**[S${entry.muServer}]** ${entry.boss.name} — ${remainingLabel}`;
}

export function buildDashboardEmbed(entries: DashboardEntry[], now = new Date()) {
  const upcoming = entries
    .filter((entry) => entry.nextSpawnAt)
    .sort(
      (left, right) =>
        (left.nextSpawnAt?.getTime() ?? 0) - (right.nextSpawnAt?.getTime() ?? 0),
    )
    .slice(0, 12);

  const lines =
    upcoming.length > 0
      ? upcoming
          .map((entry) => buildUpcomingLine(entry, now))
          .filter((line): line is string => Boolean(line))
      : [
          "Sin timers activos.",
          "Selecciona un boss abajo y pulsa **Murió S1 / S2 / S3** cuando lo maten.",
        ];

  return new EmbedBuilder()
    .setColor(0xd4a017)
    .setTitle("MU DREAM — Boss Timers")
    .setDescription(
      [
        "Próximos respawns (servidores 1, 2 y 3):",
        "",
        ...lines,
        "",
        "1. Elige un boss en el menú",
        "2. Pulsa en qué servidor MU murió",
        "",
        "Panel fijado arriba en su canal. Los avisos van al canal de notificaciones.",
        "Cualquier miembro con acceso a este canal puede marcar bosses.",
        "5 min antes del respawn recibirás un aviso con imagen y botones.",
      ].join("\n"),
    )
    .setFooter({ text: "Hora del servidor MU DREAM: UTC+2" })
    .setTimestamp(now);
}

export function buildKillButtons(bossId: string | null) {
  const disabled = !bossId;

  return [1, 2, 3].map((server) =>
    new ButtonBuilder()
      .setCustomId(`kill:${bossId ?? "none"}:${server}`)
      .setLabel(`Murió S${server}`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

export function buildNotificationKillButtons(bossId: string) {
  return [1, 2, 3].map((server) =>
    new ButtonBuilder()
      .setCustomId(`kill:${bossId}:${server}`)
      .setLabel(`☠️ Murió S${server}`)
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildDashboardComponents(selectedBossId?: string) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("select_boss")
    .setPlaceholder("Seleccionar boss")
    .addOptions(
      getAllBosses().map((boss) => ({
        label: boss.name,
        value: boss.id,
        description: boss.location.slice(0, 100),
        default: boss.id === selectedBossId,
      })),
    );

  const refreshButton = new ButtonBuilder()
    .setCustomId("refresh_dashboard")
    .setLabel("Actualizar")
    .setStyle(ButtonStyle.Secondary);

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buildKillButtons(selectedBossId ?? null)),
    new ActionRowBuilder<ButtonBuilder>().addComponents(refreshButton),
  ];
}

export function buildNotificationEmbed(
  status: BossStatus,
  muServer: MuServer,
  now = new Date(),
) {
  const remainingMs = status.nextSpawnAt
    ? status.nextSpawnAt.getTime() - now.getTime()
    : 0;

  return new EmbedBuilder()
    .setColor(0xff4500)
    .setTitle(`${status.boss.name} — Servidor MU ${muServer}`)
    .setDescription(
      [
        `**Aparecerá en ~5 minutos**`,
        `**Ubicación:** ${status.boss.location}`,
        `**Respawn:** ${getSpawnRangeLabel(status.boss)}`,
        `**Hora estimada:** ${status.nextSpawnAt ? formatServerDateTime(status.nextSpawnAt) : "—"}`,
        `**Tiempo restante:** ${formatDuration(remainingMs)}`,
        "",
        "Cuando lo maten, pulsa el botón del servidor correspondiente.",
      ].join("\n"),
    )
    .setFooter({ text: "MU DREAM Boss Tracker" })
    .setTimestamp(status.nextSpawnAt ?? now);
}

export function buildBossAttachment(bossId: string, imagePath: string) {
  const absolutePath = resolveFromRoot(imagePath);
  return new AttachmentBuilder(absolutePath, { name: `${bossId}.png` });
}

export async function sendDashboardMessage(
  channel: SendableChannels,
  entries: DashboardEntry[],
) {
  return channel.send({
    embeds: [buildDashboardEmbed(entries)],
    components: buildDashboardComponents(),
  });
}

export async function editDashboardMessage(
  message: Message,
  entries: DashboardEntry[],
  selectedBossId?: string,
) {
  await message.edit({
    embeds: [buildDashboardEmbed(entries)],
    components: buildDashboardComponents(selectedBossId),
  });
}

export function buildKillConfirmationEmbed(
  bossName: string,
  muServer: MuServer,
  nextSpawnAt: Date,
  markedBy?: string,
) {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`${bossName} marcado como muerto`)
    .setDescription(
      [
        markedBy ? `**Marcado por:** ${markedBy}` : null,
        `**Servidor MU:** ${muServer}`,
        `**Próximo respawn:** ${formatServerDateTime(nextSpawnAt)}`,
        "",
        "Aviso con imagen 5 minutos antes del respawn.",
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    );
}

export async function sendKillConfirmationToNotifyChannel(
  client: import("discord.js").Client,
  guildId: string,
  notifyChannelId: string,
  bossId: string,
  imagePath: string,
  bossName: string,
  muServer: MuServer,
  nextSpawnAt: Date,
  markedBy: string,
) {
  const channel = await client.channels.fetch(notifyChannelId).catch(() => null);
  if (!channel?.isSendable()) return;

  const embed = buildKillConfirmationEmbed(bossName, muServer, nextSpawnAt, markedBy);
  const files = imagePath ? [buildBossAttachment(bossId, imagePath)] : [];

  if (files.length > 0) {
    embed.setThumbnail(`attachment://${bossId}.png`);
  }

  await channel.send({ embeds: [embed], files });
}
