import {
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  escapeMarkdown,
} from "discord.js";

import { claimTicket, getTicketByThreadId } from "../../models/ticketModel.js";

export const data = new SlashCommandBuilder()
  .setName("claim")
  .setDescription(
    "Reclama el ticket actual. Debes estar dentro del hilo para ejecutar este comando.",
  )
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

  if (ticket.status === "CLOSED") {
    return interaction.reply({
      content: "El ticket está cerrado.",
      flags: ["Ephemeral"],
    });
  }

  if (ticket.claimedBy === interaction.user.id) {
    return interaction.reply({
      content: "Ya habías reclamado este ticket.",
      flags: ["Ephemeral"],
    });
  }

  const wasAlreadyClaimed = ticket.claimedBy !== null;

  await claimTicket(ticket.id, interaction.user.id);

  await interaction.reply({
    content: `**${escapeMarkdown(interaction.user.tag)}** ha reclamado el ticket. A partir de ahora se hará cargo.`,
  });

  if (!wasAlreadyClaimed) {
    try {
      const user = await interaction.client.users.fetch(ticket.userId);
      const claimUserEmbed = new EmbedBuilder()
        .setTitle("Ticket Atendido")
        .setDescription("Un miembro del personal de soporte ha comenzado a atender tu ticket.")
        .setColor(Colors.Green)
        .setTimestamp();
      await user.send({ embeds: [claimUserEmbed] });
    } catch {
      // no hay error, nomás ignoramos si tiene los MDs cerrados
    }
  }
}
