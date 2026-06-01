import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');

  if (!fs.existsSync(eventsPath)) {
    logger.warn(`La carpeta de eventos no existe en: ${eventsPath}`);
    return;
  }

  const eventFiles = getFiles(eventsPath);

  const events = await Promise.all(
    eventFiles.map(async (file) => {
      try {
        const imported = await import(pathToFileURL(file).href);

        return {
          file,
          event: imported.default ?? imported,
        };
      } catch (error) {
        logger.error(`Ocurrió un error al cargar el evento ${file}`, error);

        return null;
      }
    }),
  );

  let loadedCount = 0;

  for (const data of events) {
    const { event } = data;

    if (!event.name || typeof event.execute !== 'function') {
      logger.warn(`El evento ${data.file} no es válido.`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }

    loadedCount++;
  }

  logger.info(`Se han cargado ${loadedCount} eventos correctamente.`);
}

function getFiles(dir) {
  const entries = fs.readdirSync(dir, {
    withFileTypes: true,
  });

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
