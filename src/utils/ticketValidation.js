import { getTicketById } from "../models/ticketModel.js";

export async function validateOpenTicket(interaction, ticketId) {
  const ticket = await getTicketById(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "El ticket ya no existe.",
      flags: ["Ephemeral"],
    });
    return null;
  }

  if (ticket.status === "CLOSED") {
    await interaction.reply({
      content: "El ticket ya está cerrado.",
      flags: ["Ephemeral"],
    });
    return null;
  }

  return ticket;
}

export async function validateTicketExists(interaction, ticketId) {
  const ticket = await getTicketById(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "Ticket no encontrado.",
      flags: ["Ephemeral"],
    });
    return null;
  }

  return ticket;
}
