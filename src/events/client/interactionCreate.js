import {
  handleEditPanelButton,
  handleEditPanelDesc,
  handleEditPanelModal,
  handlePanelTeamsSelect,
  handleSendPanelButton,
} from "../../services/admin/panelEditor.js";
import { confirmModMessage, cancelModMessage } from "../../services/message/message.js";
import {
  claimTicket,
  createTicket,
  handleCloseTicketButton,
  handleInactivityTicketButton,
  handleMoveTicketButton,
  moveTicket,
} from "../../services/ticket/ticket.js";
import logger from "../../utils/logger.js";

async function handleCommand(interaction, client) {
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    logger.error(
      `Ocurrió un error en el comando ${interaction.commandName}: ${error}`,
    );

    const response = {
      content:
        "Ocurrió un error al ejecutar este comando. Por favor, contacta con un desarrollador.",
      flags: ["Ephemeral"],
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
}

async function handleSelectMenu(interaction, client) {
  switch (interaction.customId) {
    case "ticket_select_team":
      return createTicket(interaction, client);
    case "staff_menu":
      switch (interaction.values[0]) {
        case "close":
          return handleCloseTicketButton(interaction);
        case "inactivity":
          return handleInactivityTicketButton(interaction, client);
        case "move":
          return handleMoveTicketButton(interaction);
        default:
          return;
      }
    case "ticket_move_team":
      return moveTicket(interaction, client);
    case "select_panel_teams":
      return handlePanelTeamsSelect(interaction);
    default:
      return;
  }
}

async function handleButton(interaction, client) {
  const { customId } = interaction;

  if (customId === "edit_panel") {
    return handleEditPanelButton(interaction);
  }

  if (customId === "edit_panel_desc") {
    return handleEditPanelDesc(interaction);
  }

  if (customId.startsWith("send_panel_")) {
    return handleSendPanelButton(interaction);
  }

  if (customId.startsWith("claim_ticket_")) {
    return claimTicket(interaction, client);
  }

  if (customId === "close_ticket") {
    return handleCloseTicketButton(interaction);
  }

  if (customId === "inactivity_ticket") {
    return handleInactivityTicketButton(interaction, client);
  }

  if (customId === "move_ticket") {
    return handleMoveTicketButton(interaction);
  }

  if (customId.startsWith("confirm_mod_msg")) {
    return confirmModMessage(interaction, client);
  }

  if (customId.startsWith("cancel_mod_msg")) {
    return cancelModMessage(interaction);
  }
}

export default {
  name: "interactionCreate",

  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        return await handleCommand(interaction, client);
      }

      if (interaction.isStringSelectMenu()) {
        return await handleSelectMenu(interaction, client);
      }

      if (interaction.isButton()) {
        return await handleButton(interaction, client);
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === "edit_panel_modal") {
          return await handleEditPanelModal(interaction);
        }
      }

      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);

        if (!command || !command.autocomplete) {
          return;
        }

        try {
          await command.autocomplete(interaction);
        } catch (error) {
          logger.error(
            `Ocurrió un error en el autocompletado de ${interaction.commandName}: ${error}`,
          );
        }
      }
    } catch (error) {
      logger.error(
        `Ocurrió un error inesperado al procesar la interacción: ${error}`,
      );

      try {
        if (interaction.isRepliable()) {
          const response = {
            content:
              "Ocurrió un error inesperado al procesar esta interacción. Por favor, intenta de nuevo.",
            flags: ["Ephemeral"],
          };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(response);
          } else {
            await interaction.reply(response);
          }
        }
      } catch (error) {
        logger.error(`Ocurrió un error al procesar la interacción: ${error}`);
      }
    }
  },
};
