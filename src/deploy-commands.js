import "dotenv/config";
import "./utils/config.js";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { REST, Routes } from "discord.js";

import logger from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory()
      ? getFiles(fullPath)
      : entry.isFile() && entry.name.endsWith(".js")
        ? fullPath
        : [];
  });

const commands = [];
const commandsPath = path.join(__dirname, "commands");

if (!fs.existsSync(commandsPath)) {
  logger.warn(`La carpeta de comandos no existe en: ${commandsPath}`);
  process.exit(1);
}

for (const file of getFiles(commandsPath)) {
  try {
    // eslint-disable-next-line no-await-in-loop
    const imported = await import(pathToFileURL(file).href);
    const command = imported.default ?? imported;

    if (!command?.data?.name || typeof command.execute !== "function") {
      logger.warn(`El comando ${file} no es válido para sincronizar.`);
      continue;
    }

    commands.push(command.data.toJSON ? command.data.toJSON() : command.data);
  } catch (error) {
    logger.error(`Ocurrió un error al cargar el comando ${file}: ${error}`);
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.CLIENT_ID) {
      logger.error(
        "Debes agregar CLIENT_ID en tu archivo .env para sincronizar los comandos.",
      );
      process.exit(1);
    }

    const data = await rest.put(
      process.env.GUILD_ID
        ? Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            process.env.GUILD_ID,
          )
        : Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    logger.info(
      `Se sincronizaron ${data.length} comandos de barra correctamente.`,
    );
  } catch (error) {
    logger.error(`Ocurrió un error al sincronizar los comandos: ${error}`);
  }
})();
