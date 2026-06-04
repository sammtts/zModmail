import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
} from "discord.js";

import { pendingModMessages } from "../../cache/pendingModMessages.js";
import { TIMEOUT_PENDING_MSG } from "../../constants.js";
import {
  getOpenTicketByUserId,
  getTicketById,
} from "../../models/ticketModel.js";
import { cleanupMessage } from "../../utils/errorHandler.js";
import logger from "../../utils/logger.js";
import { getThread } from "../../utils/threadManager.js";
import { clearInactivityTimer, clearNoReplyTimer } from "../ticket/thread.js";

export async function handleUserMessage(message, client) {
  const ticket = await getOpenTicketByUserId(message.author.id);

  if (!ticket || !ticket.threadId) {
    await message.reply(
      "No tienes ningún ticket abierto. Para comunicarte con el equipo, debes ir al servidor y abrir uno.",
    );
    return;
  }

  clearInactivityTimer(ticket.id);
  clearNoReplyTimer(ticket.id);

  const thread = await getThread(client, ticket.threadId);

  if (thread) {
    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${message.author.tag} - ${message.author.id}`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(message.content || "*Sin contenido*")
      .setColor(Colors.Blurple)
      .setFooter({ text: "Response" })
      .setTimestamp();

    if (message.attachments.size > 0) {
      embed.setImage(message.attachments.first().url);
    }

    try {
      await thread.send({ embeds: [embed] });
      await message.react("✅");
    } catch (error) {
      logger.error(
        `Ocurrió un error al enviar el mensaje del usuario al hilo ${ticket.threadId}: ${error.message}`,
      );
    }
  }
}

export async function handleModMessage(message, ticket, _client) {
  const confirmEmbed = new EmbedBuilder()
    .setDescription(
      `¿Deseas enviar el siguiente mensaje a <@${ticket.userId}>?\n\n**Contenido:**\n${message.content}`,
    )
    .setColor(Colors.Blurple);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_mod_msg_${message.id}`)
      .setLabel("Confirmar")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cancel_mod_msg_${message.id}`)
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Secondary),
  );

  const prompt = await message.reply({
    embeds: [confirmEmbed],
    components: [row],
  });

  pendingModMessages.set(message.id, {
    ticketId: ticket.id,
    content: message.content,
    attachments: message.attachments,
    modId: message.author.id,
    originalMessageId: message.id,
    promptMessageId: prompt.id,
  });

  setTimeout(() => {
    if (pendingModMessages.has(message.id)) {
      pendingModMessages.delete(message.id);
      cleanupMessage(prompt);
    }
  }, TIMEOUT_PENDING_MSG);
}

export async function confirmModMessage(interaction, client) {
  const originalMsgId = interaction.customId.replace("confirm_mod_msg_", "");
  const pendingMsg = pendingModMessages.get(originalMsgId);

  if (!pendingMsg) {
    return interaction.reply({
      content: "No se encontró este mensaje.",
      flags: ["Ephemeral"],
    });
  }

  if (pendingMsg.modId !== interaction.user.id) {
    return interaction.reply({
      content: "No puedes confirmar el mensaje de otro moderador.",
      flags: ["Ephemeral"],
    });
  }

  const ticket = await getTicketById(pendingMsg.ticketId);

  if (!ticket) {
    return interaction.reply({
      content: "Ticket no encontrado.",
      flags: ["Ephemeral"],
    });
  }

  try {
    const user = await client.users.fetch(ticket.userId);
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `Soporte — ${guild ? guild.name : "Servidor"}`,
        iconURL: guild ? guild.iconURL() : undefined,
      })
      .setDescription(pendingMsg.content || "*Sin contenido*")
      .setColor(Colors.Blurple)
      .setFooter({ text: "Response" })
      .setTimestamp();

    if (pendingMsg.attachments.size > 0) {
      embed.setImage(pendingMsg.attachments.first().url);
    }

    await user.send({ embeds: [embed] });

    pendingModMessages.delete(originalMsgId);

    try {
      await interaction.message.delete();
    } catch (error) {
      logger.error(
        `Ocurrió un error al eliminar el mensaje de prompt: ${error.message}`,
      );
    }

    let originalMsg;
    try {
      originalMsg = await interaction.channel.messages.fetch(originalMsgId);
    } catch (error) {
      logger.error(
        `Ocurrió un error al obtener el mensaje original: ${error.message}`,
      );
      originalMsg = null;
    }

    if (originalMsg) {
      try {
        await originalMsg.react("✅");
      } catch (error) {
        logger.warn(
          `Ocurrió un error al reaccionar al mensaje original: ${error.message}`,
        );
      }
    }
  } catch (error) {
    logger.error(`Ocurrió un error al enviar el mensaje al usuario: ${error}`);
    await interaction.reply({
      content: "Ocurrió un error al enviar el mensaje al usuario.",
      flags: ["Ephemeral"],
    });
  }
}
