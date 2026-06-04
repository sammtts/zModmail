import { getTicketById } from "../../models/ticketModel.js";
import logger from "../../utils/logger.js";
import { closeTicketThread } from "./ticket.js";

const inactivityTimers = new Map();
const noReplyTimers = new Map();
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;
const NO_REPLY_TIMEOUT = 10 * 60 * 1000;

export function clearInactivityTimer(ticketId) {
  const timer = inactivityTimers.get(ticketId);
  if (!timer) {
    return;
  }

  clearTimeout(timer.timeout);
  inactivityTimers.delete(ticketId);
}

export function clearNoReplyTimer(ticketId) {
  const timer = noReplyTimers.get(ticketId);
  if (!timer) {
    return;
  }

  clearTimeout(timer.timeout);
  noReplyTimers.delete(ticketId);
}

export async function startInactivityTimer(
  ticket,
  thread,
  client,
  moderatorId,
) {
  clearInactivityTimer(ticket.id);

  const timeout = setTimeout(async () => {
    inactivityTimers.delete(ticket.id);

    let freshTicket;
    try {
      freshTicket = await getTicketById(ticket.id);
    } catch (error) {
      logger.error(
        `Ocurrió un error al obtener el ticket al expirar la inactividad: ${error.message}`,
      );
      return;
    }

    if (!freshTicket || freshTicket.status === "CLOSED") {
      return;
    }

    await closeTicketThread({
      ticket: freshTicket,
      thread,
      client,
      closedBy: moderatorId ?? "sistema",
      actionBy: moderatorId ?? "Sistema",
      notifyUserMessage:
        "Tu ticket fue cerrado automáticamente por inactividad. Si necesitas ayuda, abre uno nuevo.",
      closeReason: "Inactividad",
    });
  }, INACTIVITY_TIMEOUT);

  inactivityTimers.set(ticket.id, {
    timeout,
    startedAt: Date.now(),
    moderatorId,
  });
}

export async function startNoReplyTimer(ticket, thread, client) {
  clearNoReplyTimer(ticket.id);

  const timeout = setTimeout(async () => {
    noReplyTimers.delete(ticket.id);

    let freshTicket;
    try {
      freshTicket = await getTicketById(ticket.id);
    } catch (error) {
      logger.error(
        `Ocurrió un error al obtener el ticket al expirar el tiempo sin respuesta: ${error.message}`,
      );
      return;
    }

    if (!freshTicket || freshTicket.status === "CLOSED") {
      return;
    }

    await closeTicketThread({
      ticket: freshTicket,
      thread,
      client,
      closedBy: "sistema",
      actionBy: "Sistema",
      notifyUserMessage:
        "Tu ticket fue cerrado automáticamente porque no recibimos ningún mensaje tuyo en los primeros 10 minutos.",
      closeReason: "No respuesta del usuario",
    });
  }, NO_REPLY_TIMEOUT);

  noReplyTimers.set(ticket.id, { timeout, startedAt: Date.now() });
}

export async function hasUserSentMessage(thread, userId) {
  try {
    const ticketUser =
      thread.client.users.cache.get(userId) ||
      (await thread.client.users.fetch(userId));
    const userTag = ticketUser.tag;

    const messages = await thread.messages.fetch({ limit: 10 });
    return messages.some((message) => {
      if (message.author.id === thread.client.user.id) {
        return message.embeds.some((embed) => {
          if (!embed.author || embed.title) return false;
          return (
            embed.author.name === userTag ||
            embed.author.name === `${userTag} - ${userId}` ||
            embed.author.name.endsWith(`- ${userId}`)
          );
        });
      }
      return false;
    });
  } catch (error) {
    logger.error(
      `Ocurrió un error al verificar si el usuario ha enviado mensajes en el hilo: ${error.message}`,
    );
    return false;
  }
}
