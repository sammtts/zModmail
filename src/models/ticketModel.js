import {
  addActiveTicket,
  getActiveTicketByThreadId,
  getActiveTicketByUserId,
  removeActiveTicket,
  updateActiveTicket,
} from "../cache/ticketCache.js";
import { db } from "../database/db.js";

export async function getTicketById(id) {
  return db.ticket.findUnique({ where: { id } });
}

export async function getOpenTicketByUserId(userId) {
  const cached = getActiveTicketByUserId(userId);
  if (cached) {
    return cached;
  }

  const ticket = await db.ticket.findFirst({
    where: { userId, status: "OPEN" },
  });
  if (ticket) {
    addActiveTicket(ticket);
  }
  return ticket;
}

export async function getTicketByThreadId(threadId) {
  const cached = getActiveTicketByThreadId(threadId);
  if (cached) {
    return cached;
  }

  const ticket = await db.ticket.findFirst({ where: { threadId } });
  if (ticket && ticket.status === "OPEN") {
    addActiveTicket(ticket);
  }
  return ticket;
}

export async function createTicket(guildId, userId, teamId) {
  const ticket = await db.ticket.create({
    data: {
      guildId,
      userId,
      teamId,
    },
  });

  addActiveTicket(ticket);
  return ticket;
}

export async function updateTicketThread(ticketId, threadId) {
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { threadId },
  });

  updateActiveTicket(ticket);
  return ticket;
}

export async function claimTicket(ticketId, moderatorId) {
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { claimedBy: moderatorId },
  });

  updateActiveTicket(ticket);
  return ticket;
}

export async function closeTicket(ticketId, closedBy) {
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { status: "CLOSED", closedBy, closedAt: new Date() },
  });

  removeActiveTicket(ticket.userId, ticket.threadId);
  return ticket;
}

export async function moveTicket(ticketId, teamId) {
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { teamId, claimedBy: null },
  });

  updateActiveTicket(ticket);
  return ticket;
}
