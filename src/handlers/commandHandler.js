import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import logger from "../utils/logger.js";

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

export default async function loadCommands(client) {
  const commandsPath = path.join(__dirname, "..", "commands");

  if (!fs.existsSync(commandsPath)) {
    return logger.warn(`La carpeta de comandos no existe en: ${commandsPath}`);
  }

  client.commands = new Map();
  let loadedCount = 0;

  for (const file of getFiles(commandsPath)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const imported = await import(pathToFileURL(file).href);
      const command = imported.default ?? imported;

      if (!command?.data?.name || typeof command.execute !== "function") {
        logger.warn(`El comando ${file} no es válido.`);
        continue;
      }

      client.commands.set(command.data.name, command);
      loadedCount++;
    } catch (error) {
      logger.error(`Ocurrió un error al cargar el comando ${file}: ${error}`);
    }
  }

  logger.info(`Se han cargado ${loadedCount} comandos correctamente.`);
}
