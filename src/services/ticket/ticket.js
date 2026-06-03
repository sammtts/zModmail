import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Colors,
  EmbedBuilder,
  StringSelectMenuBuilder,
  escapeMarkdown,
} from "discord.js";
import discordTranscripts from "discord-html-transcripts";

import { db } from "../../database/db.js";
import { getBlacklistUser } from "../../models/blacklistModel.js";
import { getGuildConfig } from "../../models/guildModel.js";
import { getTeam, getTeamsByGuild } from "../../models/teamModel.js";
import {
  claimTicket as dbClaimTicket,
  closeTicket as dbCloseTicket,
  createTicket as dbCreateTicket,
  getOpenTicketByUserId,
  getTicketByThreadId,
  moveTicket as dbMoveTicket,
  updateTicketThread,
} from "../../models/ticketModel.js";
import logger from "../../utils/logger.js";
import { getThread } from "../../utils/threadManager.js";
import { validateOpenTicket } from "../../utils/ticketValidation.js";
import {
  clearInactivityTimer,
  clearNoReplyTimer,
  hasUserSentMessage,
  startInactivityTimer,
  startNoReplyTimer,
} from "./thread.js";

async function generateTranscript(channel) {
  try {
    return await discordTranscripts.createTranscript(channel, {
      limit: -1,
      returnType: "attachment",
      filename: `transcript-${channel.name}.html`,
      saveImages: true,
      poweredBy: false,
    });
  } catch (error) {
    logger.warn(`No se pudo generar la transcripción HTML: ${error.message}`);

    const messages = await channel.messages.fetch({ limit: 100 });
    const text = messages
      .reverse()
      .map(
        (m) =>
          `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`,
      )
      .join("\n");

    return new AttachmentBuilder(Buffer.from(text, "utf-8"), {
      name: `transcript-${channel.name}.txt`,
    });
  }
}

export async function createTicket(interaction, client) {
  await interaction.deferReply({ flags: ["Ephemeral"] });
  const teamId = interaction.values[0];
  const user = interaction.user;
  const guildId = interaction.guildId;

  const isBlacklisted = await getBlacklistUser(user.id);

  if (isBlacklisted) {
    return interaction.editReply({
      content: "Has sido bloqueado y no puedes crear tickets.",
      flags: ["Ephemeral"],
    });
  }

  const existingTicket = await getOpenTicketByUserId(user.id);
  if (existingTicket) {
    return interaction.editReply({
      content:
        "Ya tienes un ticket abierto actualmente. Por favor, espera a que se cierre antes de abrir uno nuevo.",
      flags: ["Ephemeral"],
    });
  }

  const config = await getGuildConfig(guildId);
  const team = await getTeam(teamId);

  if (!config) {
    return interaction.editReply({
      content:
        "La configuración del servidor no se ha encontrado. Por favor, contacta con un administrador.",
      flags: ["Ephemeral"],
    });
  }
  if (!config.alertChannel) {
    return interaction.editReply({
      content:
        "El canal de alertas no está configurado. Por favor, contacta con un administrador.",
      flags: ["Ephemeral"],
    });
  }
  if (!team) {
    return interaction.editReply({
      content:
        "El equipo seleccionado no existe o no está configurado correctamente.",
      flags: ["Ephemeral"],
    });
  }

  const userEmbed = new EmbedBuilder()
    .setTitle("Ticket Creado")
    .setDescription(
      "Serás contactado por un moderador pronto, mientras tanto, escribe la razón de tu ticket para agilizar el proceso de atención.",
    )
    .setTimestamp()
    .setColor(Colors.Green);

  try {
    await user.send({ embeds: [userEmbed] });
  } catch {
    return interaction.editReply({
      content:
        "No pudimos enviarte un mensaje directo. Por favor, asegúrate de tener los mensajes directos habilitados.",
      flags: ["Ephemeral"],
    });
  }

  let ticket;
  try {
    ticket = await dbCreateTicket(guildId, user.id, team.id);
  } catch (error) {
    logger.error(
      `Ocurrió un error al guardar el ticket en la base de datos: ${error}`,
    );
    return interaction.editReply({
      content:
        "Hubo un error al crear tu ticket en la base de datos. Por favor, contacta con un administrador.",
      flags: ["Ephemeral"],
    });
  }

  let thread;
  try {
    let alertChannel = client.channels.cache.get(config.alertChannel);
    if (!alertChannel) {
      alertChannel = await client.channels.fetch(config.alertChannel);
    }

    if (!alertChannel) {
      throw new Error(
        `Canal de alertas no encontrado en Discord: ${config.alertChannel}`,
      );
    }

    thread = await interaction.channel.threads.create({
      name: `[-] ${user.id} - ${team.name}`,
      type: ChannelType.PrivateThread,
      reason: `Nuevo ticket de Modmail por ${user.username}`,
    });

    const alertEmbed = new EmbedBuilder()
      .setTitle("Ticket Abierto")
      .setDescription(
        `> **Usuario:** ${escapeMarkdown(user.tag)}\n> **ID:** ${user.id}\n> **Canal:** <#${thread.id}>\n> **Atendido por:** Nadie`,
      )
      .setColor(Colors.Blurple)
      .setThumbnail(user.displayAvatarURL({ extension: "png", size: 512 }));

    const staffMenu = new StringSelectMenuBuilder()
      .setCustomId("staff_menu")
      .setPlaceholder("Menú del Staff")
      .addOptions([
        { label: "Cerrar ticket", value: "close", description: "Cerrar este ticket" },
        { label: "Iniciar inactividad", value: "inactivity", description: "Marcar ticket como inactivo" },
        { label: "Mover ticket de categoría", value: "move", description: "Mover este ticket a otro equipo" },
      ]);

    const claimRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`claim_ticket_${ticket.id}`)
        .setLabel("Atender ticket")
        .setStyle(ButtonStyle.Secondary),
    );

    await alertChannel.send({
      embeds: [alertEmbed],
      components: [claimRow],
    });

    await updateTicketThread(ticket.id, thread.id);

    const guildMember =
      interaction.member ??
      (await interaction.guild.members.fetch(user.id).catch(() => null));
    const joinedAt = guildMember?.joinedAt
      ? `<t:${Math.floor(guildMember.joinedAt.getTime() / 1000)}:R>`
      : "No disponible";

    const userInfoEmbed = new EmbedBuilder()
      .setTitle("Información del usuario")
      .setDescription(
        `> **Usuario:** ${escapeMarkdown(user.tag)}\n> **ID:** ${user.id}\n> **Fecha de creación:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n> **Fecha de unión:** ${joinedAt}`,
      )
      .setThumbnail(user.displayAvatarURL({ extension: "png", size: 512 }))
      .setColor(Colors.Blurple)
      .setFooter({ text: "Menú del Staff" });

    const staffButtons = new ActionRowBuilder().addComponents(staffMenu);

    const content = team.roleId ? `<@&${team.roleId}>` : "";
    const infoMessage = await thread.send({
      content,
      embeds: [userInfoEmbed],
      components: [staffButtons],
    });

    try {
      await infoMessage.pin();
    } catch (error) {
      logger.error(
        `Ocurrió un error al fijar el mensaje de información del usuario: ${error.message}`,
      );
    }

    await startNoReplyTimer(ticket, thread, client);
  } catch (error) {
    logger.error(
      `Ocurrió un error al crear el hilo del ticket o notificar al staff: ${error}`,
    );

    try {
      await db.ticket.delete({ where: { id: ticket.id } });
    } catch (dbErr) {
      logger.error(
        `Ocurrió un error al limpiar ticket huérfano de la base de datos: ${dbErr}`,
      );
    }

    return interaction.editReply({
      content:
        "Hubo un error al configurar el canal de soporte. Por favor, avisa a un administrador.",
      flags: ["Ephemeral"],
    });
  }

  await interaction.editReply({
    content:
      "Tu ticket ha sido creado. Un moderador te atenderá pronto por mensaje directo.",
    flags: ["Ephemeral"],
  });
}

export async function claimTicket(interaction, client) {
  const ticketId = interaction.customId.replace("claim_ticket_", "");
  const ticket = await validateOpenTicket(interaction, ticketId);

  if (!ticket) {
    return;
  }

  if (ticket.claimedBy) {
    return interaction.reply({
      content: "Este ticket ya fue reclamado.",
      flags: ["Ephemeral"],
    });
  }

  const thread = await getThread(client, ticket.threadId);

  if (!thread) {
    return interaction.reply({
      content: "No se pudo acceder al hilo del ticket.",
      flags: ["Ephemeral"],
    });
  }

  const userHasSentMessage = await hasUserSentMessage(thread, ticket.userId);
  if (!userHasSentMessage) {
    return interaction.reply({
      content:
        "No puedes atender el ticket hasta que el usuario envíe al menos un mensaje.",
      flags: ["Ephemeral"],
    });
  }

  let updatedTicket;
  try {
    updatedTicket = await dbClaimTicket(ticketId, interaction.user.id);
    await interaction.reply({
      content: "Has reclamado este ticket",
      flags: ["Ephemeral"],
    });

    const team = await getTeam(updatedTicket.teamId).catch(() => null);
    const teamName = team ? team.name : "Discord Support";

    try {
      await thread.setName(`[${interaction.user.username}] ${updatedTicket.userId} - ${teamName}`);
    } catch (error) {
      logger.error(
        `Ocurrió un error al renombrar el hilo a [${interaction.user.username}]: ${error.message}`,
      );
    }
  } catch (err) {
    logger.error(`Error al reclamar ticket en BD: ${err}`);
    return interaction.reply({ content: "No se pudo reclamar el ticket.", flags: ["Ephemeral"] });
  }

  try {
    const ticketUser =
      client.users.cache.get(updatedTicket.userId) ||
      (await client.users.fetch(updatedTicket.userId));

    const attendedEmbed = new EmbedBuilder()
      .setTitle("Ticket Atendido")
      .setDescription(
        `> **Usuario:** ${escapeMarkdown(ticketUser.tag)}\n> **ID:** ${updatedTicket.userId}\n> **Canal:** <#${thread.id}>\n> **Atendido por:** ${escapeMarkdown(interaction.user.tag)}`,
      )
      .setColor(Colors.Green)
      .setThumbnail(ticketUser.displayAvatarURL({ extension: "png", size: 512 }));

    await interaction.message.edit({ embeds: [attendedEmbed], components: [] });

    const claimUserEmbed = new EmbedBuilder()
      .setTitle("Ticket Atendido")
      .setDescription("Un miembro del personal de soporte ha comenzado a atender tu ticket.")
      .setColor(Colors.Green)
      .setTimestamp();
    await ticketUser.send({ embeds: [claimUserEmbed] });
  } catch (error) {
    logger.error(
      `Ocurrió un error al actualizar el mensaje de alerta o notificar al usuario tras atender: ${error.message}`,
    );
  }

  try {
    const ticketUser =
      client.users.cache.get(ticket.userId) ||
      (await client.users.fetch(ticket.userId));
    await thread.send(
      `${interaction.user}: has atendido el ticket de **${ticketUser.username}**.`,
    );
  } catch (error) {
    logger.error(
      `Ocurrió un error al enviar el mensaje de reclamación al hilo ${ticket.threadId}: ${error.message}`,
    );
  }
}

export async function moveTicket(interaction, _client) {
  const teamId = interaction.values[0];
  const ticket = await getTicketByThreadId(interaction.channel.id);

  if (!ticket) {
    return interaction.reply({
      content: "Ticket no encontrado.",
      flags: ["Ephemeral"],
    });
  }

  const team = await getTeam(teamId);

  if (!team) {
    return interaction.reply({
      content: "Equipo no encontrado.",
      flags: ["Ephemeral"],
    });
  }

  const oldTeam = await getTeam(ticket.teamId).catch(() => null);

  await dbMoveTicket(ticket.id, team.id);

  await interaction.update({
    content: `Ticket movido a **${team.name}**.`,
    components: [],
  });

  if (oldTeam && oldTeam.roleId) {
    try {
      const threadMembers = await interaction.channel.members.fetch();
      for (const [memberId, _] of threadMembers) {
        if (memberId === interaction.client.user.id || memberId === ticket.userId) {
          continue;
        }

        let shouldRemove = false;
        if (ticket.claimedBy && memberId === ticket.claimedBy) {
          shouldRemove = true;
        } else {
          const guildMember = await interaction.guild.members.fetch(memberId).catch(() => null);
          if (guildMember && guildMember.roles.cache.has(oldTeam.roleId)) {
            shouldRemove = true;
          }
        }

        if (shouldRemove) {
          await interaction.channel.members.remove(memberId).catch((err) => {
            logger.error(`Error al remover miembro ${memberId} del hilo: ${err.message}`);
          });
        }
      }
    } catch (error) {
      logger.error(`Error al obtener miembros del hilo para remover staff anterior: ${error.message}`);
    }
  }

  const moveEmbed = new EmbedBuilder()
    .setTitle("Ticket Transferido")
    .setDescription(`Tu ticket ha sido transferido al departamento de **${team.name}**.`)
    .setColor(Colors.Blurple)
    .setTimestamp();

  try {
    const user = await interaction.client.users.fetch(ticket.userId);
    await user.send({ embeds: [moveEmbed] });
  } catch (error) {
    logger.error(`Ocurrió un error al notificar al usuario sobre el movimiento de categoría: ${error.message}`);
  }

  if (team.roleId) {
    const staffText = ticket.claimedBy
      ? `<@${ticket.claimedBy}> - ${ticket.claimedBy}`
      : "Ninguno";
    const embed = new EmbedBuilder()
      .setTitle("El ticket ha sido movido correctamente")
      .setDescription(
        `> **Usuario:** <@${ticket.userId}> - ${ticket.userId}\n> **Staff anterior:** ${staffText}\n> **Sección encargada:** ${team.name}`,
      )
      .setColor(Colors.Blurple)
      .setTimestamp();

    await interaction.channel.send({
      content: team.roleId ? `<@&${team.roleId}>` : "",
      embeds: [embed],
    });
  }
}

export async function closeTicketThread({
  ticket,
  thread,
  client,
  closedBy,
  actionBy,
  notifyUserMessage,
  closeReason,
}) {
  try {
    await dbCloseTicket(ticket.id, closedBy);
  } catch (error) {
    logger.error(
      `Ocurrió un error al cerrar el ticket en la base de datos: ${error.message}`,
    );
  }

  const config = await getGuildConfig(thread.guild.id);
  const attachment = await generateTranscript(thread);

  const closeEmbed = new EmbedBuilder()
    .setTitle("Ticket Cerrado")
    .setDescription(
      `El ticket de <@${ticket.userId}> fue cerrado por ${actionBy}`,
    )
    .setColor(Colors.Red);

  if (config?.transcriptChannel) {
    try {
      let transcriptChannel = client.channels.cache.get(
        config.transcriptChannel,
      );
      if (!transcriptChannel) {
        transcriptChannel = await client.channels.fetch(
          config.transcriptChannel,
        );
      }

      if (transcriptChannel) {
        await transcriptChannel.send({
          embeds: [closeEmbed],
          files: [attachment],
        });
      }
    } catch (error) {
      logger.error(
        `Ocurrió un error al enviar la transcripción al canal ${config.transcriptChannel}: ${error.message}`,
      );
    }
  }

  if (notifyUserMessage) {
    try {
      const user = await client.users.fetch(ticket.userId);
      let embedToSend;
      if (typeof notifyUserMessage === "string") {
        embedToSend = new EmbedBuilder()
          .setTitle("Ticket Cerrado")
          .setDescription(notifyUserMessage)
          .setColor(Colors.Red)
          .setTimestamp();
      } else {
        embedToSend = notifyUserMessage;
      }
      await user.send({ embeds: [embedToSend] });
    } catch (error) {
      logger.error(
        `Ocurrió un error al notificar al usuario sobre el cierre del ticket: ${error.message}`,
      );
    }
  }

  try {
    await thread.delete(`Ticket cerrado: ${closeReason ?? actionBy}`);
  } catch (error) {
    logger.error(
      `Ocurrió un error al eliminar el thread del ticket: ${error.message}`,
    );
  }
}

export async function handleCloseTicketButton(interaction) {
  const ticket = await getTicketByThreadId(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({
      content: "No se encontró un ticket asociado a este hilo.",
      flags: ["Ephemeral"],
    });
  }

  if (ticket.status === "CLOSED") {
    return interaction.reply({
      content: "El ticket ya está cerrado.",
      flags: ["Ephemeral"],
    });
  }

  try {
    clearInactivityTimer(ticket.id);
    clearNoReplyTimer(ticket.id);

    await interaction.reply({
      content:
        "El ticket está siendo cerrado y se está generando una transcripción.",
      flags: ["Ephemeral"],
    });

    await closeTicketThread({
      ticket,
      thread: interaction.channel,
      client: interaction.client,
      closedBy: interaction.user.id,
      actionBy: interaction.user.tag,
      notifyUserMessage: "Tu ticket fue cerrado por el personal de soporte.",
      closeReason: "Cerrado por staff",
    });
  } catch (error) {
    logger.error(
      `Ocurrió un error al cerrar el ticket desde el botón: ${error.message}`,
    );
    return interaction.reply({
      content: "No se pudo cerrar el ticket. Por favor, intenta de nuevo.",
      flags: ["Ephemeral"],
    });
  }
}

export async function handleInactivityTicketButton(interaction, client) {
  const ticket = await getTicketByThreadId(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({
      content: "No se encontró un ticket asociado a este hilo.",
      flags: ["Ephemeral"],
    });
  }

  if (ticket.status === "CLOSED") {
    return interaction.reply({
      content: "El ticket ya está cerrado.",
      flags: ["Ephemeral"],
    });
  }

  try {
    const threadInactivityEmbed = new EmbedBuilder()
      .setTitle("Periodo de Inactividad")
      .setDescription(
        "Se ha iniciado el periodo de inactividad para este ticket. El usuario ha sido notificado y el ticket se cerrará automáticamente si no responde en 15 minutos.",
      )
      .setColor(Colors.Blurple)
      .setTimestamp();

    await interaction.reply({
      embeds: [threadInactivityEmbed],
    });

    try {
      const user = await client.users.fetch(ticket.userId);
      const inactivityUserEmbed = new EmbedBuilder()
        .setTitle("Periodo de Inactividad")
        .setDescription(
          "El equipo de soporte ha iniciado un periodo de inactividad en tu ticket. Esto se debe a que no hemos recibido una respuesta. Si no recibimos una respuesta en los próximos 15 minutos, cerraremos el ticket automáticamente.",
        )
        .setColor(Colors.Blurple)
        .setTimestamp();

      await user.send({ embeds: [inactivityUserEmbed] });
    } catch (error) {
      logger.error(
        `Ocurrió un error al avisar al usuario sobre la inactividad: ${error.message}`,
      );
    }

    await startInactivityTimer(
      ticket,
      interaction.channel,
      client,
      interaction.user.id,
    );
  } catch (error) {
    logger.error(
      `Ocurrió un error al iniciar inactividad desde el botón: ${error.message}`,
    );
    if (!interaction.replied) {
      return interaction.reply({
        content:
          "No se pudo iniciar el periodo de inactividad. Por favor, intenta de nuevo.",
        flags: ["Ephemeral"],
      });
    }
  }
}

export async function handleMoveTicketButton(interaction) {
  const ticket = await getTicketByThreadId(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({
      content: "No se encontró un ticket asociado a este hilo.",
      flags: ["Ephemeral"],
    });
  }

  if (ticket.status === "CLOSED") {
    return interaction.reply({
      content: "El ticket ya está cerrado.",
      flags: ["Ephemeral"],
    });
  }

  const teams = await getTeamsByGuild(interaction.guildId);
  if (!teams || teams.length === 0) {
    return interaction.reply({
      content:
        "No hay equipos configurados para mover el ticket. Por favor, habla con un administrador.",
      flags: ["Ephemeral"],
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("ticket_move_team")
    .setPlaceholder("Selecciona un nuevo equipo...")
    .addOptions(
      teams.map((team) => ({
        label: team.name,
        value: team.id,
      })),
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const movePanelEmbed = new EmbedBuilder()
    .setTitle("Transferir Ticket")
    .setDescription("Selecciona el equipo a continuación para mover este ticket.")
    .setColor(Colors.Blurple);

  return interaction.reply({
    embeds: [movePanelEmbed],
    components: [row],
  });
}
