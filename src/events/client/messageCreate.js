import { getTicketByThreadId } from "../../models/ticketModel.js";
import {
  handleModMessage,
  handleUserMessage,
} from "../../services/message/message.js";
import logger from "../../utils/logger.js";

export default {
  name: "messageCreate",

  async execute(message, client) {
    try {
      if (message.author.bot) {
        return;
      }

      if (!message.guild) {
        await handleUserMessage(message, client);
        return;
      }

      if (message.channel.isThread()) {
        const ticket = await getTicketByThreadId(message.channel.id);

        if (ticket && ticket.status === "OPEN") {
          await handleModMessage(message, ticket, client);
        }
      }
    } catch (error) {
      logger.error(
        `Ocurrió un error al procesar el mensaje del usuario/moderador: ${error}`,
      );
    }
  },
};
