import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { getGuildConfig, updatePanelConfig } from "../../models/guildModel.js";
import {
  getTeamsByGuild,
  getVisibleTeamsByGuild,
  setPanelTeams,
} from "../../models/teamModel.js";
import logger from "../../utils/logger.js";

export async function handleEditPanelButton(interaction) {
  const config = await getGuildConfig(interaction.guildId);

  const modal = new ModalBuilder()
    .setCustomId("edit_panel_modal")
    .setTitle("Editar panel de Soporte");

  const titleInput = new TextInputBuilder()
    .setCustomId("panel_title")
    .setLabel("Título del Panel")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(config.panelTitle || "Sistema de Soporte del Servidor");

  const colorInput = new TextInputBuilder()
    .setCustomId("panel_color")
    .setLabel("Color (HEX o nombre en inglés)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(config.panelColor || "Blurple");

  const thumbInput = new TextInputBuilder()
    .setCustomId("panel_thumb")
    .setLabel("URL de la miniatura")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(config.panelThumbnail || "");

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(colorInput),
    new ActionRowBuilder().addComponents(thumbInput),
  );

  await interaction.showModal(modal);
}

export async function handleEditPanelModal(interaction) {
  const title = interaction.fields.getTextInputValue("panel_title");
  const color = interaction.fields.getTextInputValue("panel_color");
  const thumb = interaction.fields.getTextInputValue("panel_thumb");

  await updatePanelConfig(interaction.guildId, {
    panelTitle: title,
    panelColor: color,
    panelThumbnail: thumb || null,
  });

  await refreshPanelPreview(interaction);
}

export async function handleEditPanelDesc(interaction) {
  await interaction.reply({
    content:
      "Envía la nueva descripción en este canal. Tienes **10 minutos** para responder, o puedes escribir `cancelar`.",
  });

  const filter = (m) => m.author.id === interaction.user.id;
  const collector = interaction.channel.createMessageCollector({
    filter,
    time: 600000,
    max: 1,
  });

  collector.on("collect", async (m) => {
    if (m.content.toLowerCase() === "cancelar") {
      await interaction.followUp({
        content: "Cancelado.",
      });
      return;
    }

    await updatePanelConfig(interaction.guildId, {
      panelDescription: m.content,
    });

    await interaction.followUp({
      content: "La descripción ha sido actualizada correctamente.",
    });

    if (m.deletable) {
      m.delete().catch(() => {});
    }

    await refreshPanelPreviewFromMessage(interaction.message);
  });

  collector.on("end", (collected) => {
    if (collected.size === 0) {
      interaction
        .followUp({
          content: "El tiempo se ha acabado. No se actualizó la descripción.",
          flags: ["Ephemeral"],
        })
        .catch(() => {});
    }
  });
}

export async function handleSendPanelButton(interaction) {
  const channelId = interaction.customId.replace("send_panel_", "");
  let channel = interaction.guild.channels.cache.get(channelId);
  if (!channel) {
    try {
      channel = await interaction.guild.channels.fetch(channelId);
    } catch (error) {
      logger.error(
        `Ocurrió un error al obtener el canal de destino ${channelId} en Discord: ${error}`,
      );
    }
  }

  if (!channel) {
    return interaction.reply({
      content: "El canal destino no existe o no se pudo obtener.",
      flags: ["Ephemeral"],
    });
  }

  const config = await getGuildConfig(interaction.guildId);
  const visibleTeams = await getVisibleTeamsByGuild(interaction.guildId);

  if (visibleTeams.length === 0) {
    return interaction.reply({
      content:
        "Debes seleccionar al menos un equipo en el menú antes de enviar el panel.",
      flags: ["Ephemeral"],
    });
  }

  let color = config.panelColor || "Blurple";

  try {
    new EmbedBuilder().setColor(color);
  } catch (error) {
    logger.error(`Ocurrió un error al establecer el color del panel: ${error}`);
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

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select_team")
    .setPlaceholder("Selecciona un equipo de soporte...")
    .addOptions(
      visibleTeams.map((team) => ({
        label: team.name,
        value: team.id,
      })),
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await channel.send({ embeds: [embed], components: [row] });
  const successEmbed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setAuthor({
      name: interaction.user.tag,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setDescription(`El panel ha sido enviado a <#${channelId}> correctamente`);

  await interaction.reply({
    embeds: [successEmbed],
  });
}

async function buildPanelPreviewOptions(guildId, oldComponents) {
  const config = await getGuildConfig(guildId);
  const teams = await getTeamsByGuild(guildId);

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
    try {
      new URL(config.panelThumbnail);
      embed.setThumbnail(config.panelThumbnail);
    } catch (error) {
      logger.error(
        `Ocurrió un error al establecer la miniatura del panel: ${error}`,
      );
    }
  }

  const editButton = new ButtonBuilder()
    .setCustomId("edit_panel")
    .setLabel("Editar panel")
    .setStyle(ButtonStyle.Primary);

  const editDescButton = new ButtonBuilder()
    .setCustomId("edit_panel_desc")
    .setLabel("Editar descripción")
    .setStyle(ButtonStyle.Primary);

  let channelId = "";

  const oldButtonsRow = oldComponents ? oldComponents[0] : null;

  if (oldButtonsRow && oldButtonsRow.components[2]) {
    channelId = oldButtonsRow.components[2].customId.replace("send_panel_", "");
  } else if (
    oldButtonsRow &&
    oldButtonsRow.components[1] &&
    oldButtonsRow.components[1].customId.startsWith("send_panel_")
  ) {
    channelId = oldButtonsRow.components[1].customId.replace("send_panel_", "");
  }

  const sendButton = new ButtonBuilder()
    .setCustomId(`send_panel_${channelId}`)
    .setLabel("Enviar")
    .setStyle(ButtonStyle.Secondary);

  const rowButtons = new ActionRowBuilder().addComponents(
    editButton,
    editDescButton,
    sendButton,
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("select_panel_teams")
    .setPlaceholder("Selecciona los equipos visibles en el panel...")
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

  return {
    content:
      'Esta es una vista previa del panel. Usa las opciones de abajo para personalizarlo y, luego, para enviarlo, presiona "Enviar".',
    embeds: [embed],
    components: [rowButtons, rowSelect],
  };
}

export async function refreshPanelPreview(interaction) {
  const opts = await buildPanelPreviewOptions(
    interaction.guildId,
    interaction.message.components,
  );
  await interaction.update(opts);
}

export async function refreshPanelPreviewFromMessage(message) {
  const opts = await buildPanelPreviewOptions(
    message.guild.id,
    message.components,
  );
  await message.edit(opts);
}

export async function handlePanelTeamsSelect(interaction) {
  const selectedTeamIds = interaction.values;
  await setPanelTeams(interaction.guildId, selectedTeamIds);
  await refreshPanelPreview(interaction);
}
