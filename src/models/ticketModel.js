import { db } from "../database/db.js";
import logger from "../utils/logger.js";

const activeTicketsByUserId = new Map();
const activeTicketsByThreadId = new Map();

function addActiveTicket(ticket) {
  if (ticket.userId) {
    activeTicketsByUserId.set(ticket.userId, ticket);
  }
  if (ticket.threadId) {
    activeTicketsByThreadId.set(ticket.threadId, ticket);
  }
}

function removeActiveTicket(userId, threadId) {
  if (userId) {
    activeTicketsByUserId.delete(userId);
  }
  if (threadId) {
    activeTicketsByThreadId.delete(threadId);
  }
}

function getActiveTicketByUserId(userId) {
  return activeTicketsByUserId.get(userId);
}

function getActiveTicketByThreadId(threadId) {
  return activeTicketsByThreadId.get(threadId);
}

function updateActiveTicket(ticket) {
  addActiveTicket(ticket);
}

export async function initializeTicketCache(dbInstance) {
  try {
    const openTickets = await dbInstance.ticket.findMany({
      where: { status: "OPEN" },
    });
    for (const ticket of openTickets) {
      addActiveTicket(ticket);
    }
  } catch (error) {
    logger.error("Ocurrió un error al inicializar el caché de tickets:", error);
  }
}

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
