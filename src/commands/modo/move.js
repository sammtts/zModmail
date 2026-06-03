import {
  ActionRowBuilder,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

import { getTeamsByGuild } from "../../models/teamModel.js";
import { getTicketByThreadId } from "../../models/ticketModel.js";

export const data = new SlashCommandBuilder()
  .setName("move")
  .setDescription("Mueve el ticket a otro equipo")
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

  const teams = await getTeamsByGuild(interaction.guildId);

  if (teams.length === 0) {
    return interaction.reply({
      content:
        "No hay equipos configurados para mover el ticket. Por favor, habla con un administrador.",
      flags: ["Ephemeral"],
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("ticket_move_team")
    .setPlaceholder("Selecciona un nuevo equipo...")
    .addOptions(
      teams.map((team) => ({
        label: team.name,
        value: team.id,
      })),
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const movePanelEmbed = new EmbedBuilder()
    .setTitle("Transferir Ticket")
    .setDescription("Selecciona el equipo a continuación para mover este ticket.")
    .setColor(Colors.Blurple);

  await interaction.reply({
    embeds: [movePanelEmbed],
    components: [row],
  });
}
