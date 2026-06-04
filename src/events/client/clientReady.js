import { initializeTicketCache } from "../../models/ticketModel.js";
import { db } from "../../database/db.js";
import logger from "../../utils/logger.js";

export default {
  name: "clientReady",
  once: true,

  async execute(client) {
    await initializeTicketCache(db);
    logger.info(`Conectado como ${client.user.tag}`);
  },
};
