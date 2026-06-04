import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { getTicketByThreadId } from "../../models/ticketModel.js";
import { closeTicketThread } from "../../services/ticket/ticket.js";

export const data = new SlashCommandBuilder()
  .setName("close")
  .setDescription("Cierra el ticket y genera un transcript")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction) {
  if (!interaction.channel.isThread()) {
    return interaction.reply({
      content: "Este comando solo puede usarse dentro del hilo de un ticket.",
      flags: ["Ephemeral"],
    });
  }

  const ticket = await getTicketByThreadId(interaction.channel.id);

  if (!ticket) {
    return interaction.reply({
      content: "No se encontró un ticket asociado a este hilo.",
      flags: ["Ephemeral"],
    });
  }

  await closeTicketThread({
    ticket,
    thread: interaction.channel,
    client: interaction.client,
    closedBy: interaction.user.id,
    actionBy: interaction.user.tag,
    notifyUserMessage: `Tu ticket fue cerrado por ${interaction.user.tag}.`,
    closeReason: "Cerrado por staff",
  });
}
