const activeTicketsByUserId = new Map();
const activeTicketsByThreadId = new Map();

export function addActiveTicket(ticket) {
  if (ticket.userId) {
    activeTicketsByUserId.set(ticket.userId, ticket);
  }
  if (ticket.threadId) {
    activeTicketsByThreadId.set(ticket.threadId, ticket);
  }
}

export function removeActiveTicket(userId, threadId) {
  if (userId) {
    activeTicketsByUserId.delete(userId);
  }
  if (threadId) {
    activeTicketsByThreadId.delete(threadId);
  }
}

export function getActiveTicketByUserId(userId) {
  return activeTicketsByUserId.get(userId);
}

export function getActiveTicketByThreadId(threadId) {
  return activeTicketsByThreadId.get(threadId);
}

export function updateActiveTicket(ticket) {
  addActiveTicket(ticket);
}

export async function initializeTicketCache(db) {
  try {
    const openTickets = await db.ticket.findMany({
      where: { status: "OPEN" },
    });
    for (const ticket of openTickets) {
      addActiveTicket(ticket);
    }
  } catch (error) {
    console.error("Error al inicializar el caché de tickets:", error);
  }
}
