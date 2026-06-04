import {
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import {
  getGuildConfig,
  updateAlertChannel,
  updateTranscriptChannel,
  upsertGuildConfig,
} from "../../models/guildModel.js";
import { getTeamsByGuild } from "../../models/teamModel.js";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Configura el sistema de Modmail")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("panel")
      .setDescription(
        "Envía el panel para que los usuarios puedan abrir tickets.",
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Canal donde enviar el panel")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("alerts")
      .setDescription("Configura el canal de alertas para nuevos tickets")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Canal de alertas")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("transcripts")
      .setDescription("Configura el canal de transcripciones")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Canal de transcripciones")
          .setRequired(true),
      ),
  );

export async function execute(interaction) {
  const subCmd = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  await upsertGuildConfig(guildId);

  if (subCmd === "alerts") {
    const channel = interaction.options.getChannel("channel");

    await updateAlertChannel(guildId, channel.id);
    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setDescription(`El canal de alertas ha sido configurado a <#${channel.id}>`);

    await interaction.reply({
      embeds: [embed],
    });
  } else if (subCmd === "transcripts") {
    const channel = interaction.options.getChannel("channel");

    await updateTranscriptChannel(guildId, channel.id);
    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setDescription(`El canal de transcripciones ha sido configurado a <#${channel.id}>`);

    await interaction.reply({
      embeds: [embed],
    });
  } else if (subCmd === "panel") {
    const channel = interaction.options.getChannel("channel");
    const teams = await getTeamsByGuild(guildId);

    if (teams.length === 0) {
      return interaction.reply({
        content:
          "Debes añadir al menos un equipo usando `/teams add` antes de usar este comando.",
        flags: ["Ephemeral"],
      });
    }

    const config = await getGuildConfig(guildId);

    const {
      ActionRowBuilder,
      StringSelectMenuBuilder,
      ButtonBuilder,
      ButtonStyle,
    } = await import("discord.js");

    const editButton = new ButtonBuilder()
      .setCustomId("edit_panel")
      .setLabel("Editar panel")
      .setStyle(ButtonStyle.Primary);

    const editDescButton = new ButtonBuilder()
      .setCustomId("edit_panel_desc")
      .setLabel("Editar descripción")
      .setStyle(ButtonStyle.Primary);

    const sendButton = new ButtonBuilder()
      .setCustomId(`send_panel_${channel.id}`)
      .setLabel("Enviar")
      .setStyle(ButtonStyle.Secondary);

    const rowButtons = new ActionRowBuilder().addComponents(
      editButton,
      editDescButton,
      sendButton,
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_panel_teams")
      .setPlaceholder("Selecciona los equipos públicos...")
      .setMinValues(1)
      .setMaxValues(teams.length)
      .addOptions(
        teams.map((team) => ({
          label: team.name,
          value: team.id,
          default: team.isPanelVisible,
        })),
      );

    const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

    let color = config.panelColor || "Blurple";

    try {
      new EmbedBuilder().setColor(color);
    } catch {
      color = "Blurple";
    }

    const embed = new EmbedBuilder()
      .setTitle(config.panelTitle || "Sistema de Soporte del Servidor")
      .setDescription(
        config.panelDescription ||
          "Selecciona un equipo de soporte a continuación para abrir un ticket. Nos comunicaremos contigo por mensaje directo.",
      )
      .setColor(color);

    if (config.panelThumbnail) {
      embed.setThumbnail(config.panelThumbnail);
    }

    await interaction.reply({
      content:
        'Esta es una vista previa del panel. Usa las opciones de abajo para personalizarlo y, luego, para enviarlo, presiona "Enviar".',
      embeds: [embed],
      components: [rowButtons, rowSelect],
    });
  }
}
