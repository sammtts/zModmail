import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import {
  blacklistUser,
  getAllBlacklisted,
  removeBlacklist,
} from "../../models/blacklistModel.js";
import logger from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("blacklist")
  .setDescription("Gestiona la lista negra de usuarios")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Añade a un usuario a la lista negra")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Usuario a blacklistear")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Razón del blacklist")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Remueve a un usuario de la lista negra")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Usuario a desblacklistear")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("Muestra la lista de usuarios en la lista negra"),
  );

export async function execute(interaction) {
  const subCmd = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser("user");

  if (subCmd === "add") {
    const reason = interaction.options.getString("reason") || "No especificada";

    await blacklistUser(targetUser.id, reason, interaction.user.id);
    await interaction.reply({
      content: `El usuario <@${targetUser.id}> ha sido añadido a la lista negra y no podrá usar el sistema de soporte. Razón: ${reason}`,
    });
  } else if (subCmd === "remove") {
    try {
      await removeBlacklist(targetUser.id);
      await interaction.reply({
        content: `El usuario <@${targetUser.id}> ha sido removido de la lista negra.`,
      });
    } catch (error) {
      await interaction.reply({
        content: "El usuario no estaba en la lista negra u ocurrió un error.",
        flags: ["Ephemeral"],
      });
      logger.error(
        `Ocurrió un error al ejecutar el comando \`/blacklist remove\`: ${error}`,
      );
    }
  } else if (subCmd === "list") {
    const bl = await getAllBlacklisted();

    if (bl.length === 0) {
      return interaction.reply({
        content: "No hay usuarios en la lista negra.",
        flags: ["Ephemeral"],
      });
    }

    const list = bl
      .map((b) => `- <@${b.userId}> (Razón: ${b.reason || "No especificada"})`)
      .join("\n");
    await interaction.reply({
      content: `**Usuarios en la lista negra:**\n${list}`,
    });
  }
}
