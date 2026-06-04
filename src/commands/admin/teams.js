import { Colors, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import {
  createTeam,
  deleteTeam,
  getTeam,
  getTeamsByGuild,
  updateTeam,
} from "../../models/teamModel.js";
import logger from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("teams")
  .setDescription("Administra los equipos de soporte")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Agrega un nuevo equipo de soporte")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Nombre del equipo")
          .setRequired(true),
      )
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("Rol asociado con este equipo")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Elimina un equipo de soporte")
      .addStringOption((option) =>
        option
          .setName("team")
          .setDescription("El equipo a eliminar")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("edit")
      .setDescription("Edita un equipo de soporte existente")
      .addStringOption((option) =>
        option
          .setName("team")
          .setDescription("El equipo a editar")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Nuevo nombre")
          .setRequired(false),
      )
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("Nuevo rol asociado a este equipo")
          .setRequired(false),
      ),
  );

export async function autocomplete(interaction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const teams = await getTeamsByGuild(interaction.guildId);

  const filtered = teams.filter((team) =>
    team.name.toLowerCase().includes(focusedValue),
  );

  await interaction.respond(
    filtered.slice(0, 25).map((team) => ({ name: team.name, value: team.id })),
  );
}

export async function execute(interaction) {
  const subCmd = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (subCmd === "add") {
    const name = interaction.options.getString("name");
    const role = interaction.options.getRole("role");

    await createTeam(guildId, name, role.id);
    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setDescription(`El equipo **${name}** se ha creado correctamente.`);

    await interaction.reply({
      embeds: [embed],
    });
  } else if (subCmd === "remove") {
    const teamId = interaction.options.getString("team");
    const team = await getTeam(teamId);

    if (!team || team.guildId !== guildId) {
      return interaction.reply({
        content: "El equipo no se ha encontrado.",
        flags: ["Ephemeral"],
      });
    }

    try {
      await deleteTeam(teamId);
      const embed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setDescription(`El equipo **${team.name}** ha sido eliminado.`);

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      logger.error(
        `Ocurrió un error al intentar eliminar el equipo ${teamId}: ${error}`,
      );
      await interaction.reply({
        content:
          "No se puede eliminar este equipo porque tiene tickets asociados en la base de datos.",
        flags: ["Ephemeral"],
      });
    }
  } else if (subCmd === "edit") {
    const teamId = interaction.options.getString("team");
    const team = await getTeam(teamId);

    if (!team || team.guildId !== guildId) {
      return interaction.reply({
        content: "El equipo no se ha encontrado.",
        flags: ["Ephemeral"],
      });
    }

    const newName = interaction.options.getString("name");
    const newRole = interaction.options.getRole("role");

    if (!newName && !newRole) {
      return interaction.reply({
        content:
          "Debes especificar un nuevo nombre o un nuevo rol para editar este equipo.",
        flags: ["Ephemeral"],
      });
    }

    const dataToUpdate = {};

    if (newName) {
      dataToUpdate.name = newName;
    }
    if (newRole) {
      dataToUpdate.roleId = newRole.id;
    }

    await updateTeam(teamId, dataToUpdate);

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setDescription(`El equipo **${team.name}** ha sido actualizado correctamente.`);

    await interaction.reply({
      embeds: [embed],
    });
  }
}
