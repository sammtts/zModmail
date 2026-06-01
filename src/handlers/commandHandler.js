import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function loadCommands(client) {
  const commandsPath = path.join(__dirname, '..', 'commands');

  if (!fs.existsSync(commandsPath)) {
    logger.warn(`La carpeta de comandos no existe en: ${commandsPath}`);
    return;
  }

  const commandFiles = getFiles(commandsPath);

  client.commands = new Map();

  const commands = await Promise.all(
    commandFiles.map(async (file) => {
      try {
        const imported = await import(pathToFileURL(file).href);

        return {
          file,
          command: imported.default ?? imported,
        };
      } catch (error) {
        logger.error(`Ocurrió un error al cargar el comando ${file}`, error);
        return null;
      }
    }),
  );

  let loadedCount = 0;

  for (const data of commands) {
    if (!data) {
      continue;
    }

    const { command, file } = data;

    if (!command.data?.name || typeof command.execute !== 'function') {
      logger.warn(`El comando ${file} no es válido.`);
      continue;
    }

    client.commands.set(command.data.name, command);
    loadedCount++;
  }

  logger.info(`Se han cargado ${loadedCount} comandos correctamente.`);
}

function getFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}
