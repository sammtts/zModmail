import logger from "./logger.js";

export async function handleServiceError(error, interaction, action) {
  logger.error(`Ocurrió un error en ${action}: ${error.message}`);

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "Ocurrió un error. Por favor inténtalo más tarde.",
        flags: ["Ephemeral"],
      });
    } else {
      await interaction.reply({
        content: "Ocurrió un error. Por favor inténtalo más tarde.",
        flags: ["Ephemeral"],
      });
    }
  } catch (replyError) {
    logger.error(
      `No se pudo enviar el mensaje de error: ${replyError.message}`,
    );
  }
}
export async function cleanupMessage(message) {
  try {
    await message.edit({ components: [] });
  } catch (error) {
    logger.warn(
      `No se pudo limpiar el mensaje ${message.id}: ${error.message}`,
    );
  }
}
