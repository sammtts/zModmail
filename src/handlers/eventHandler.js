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

export default async function loadEvents(client) {
  const eventsPath = path.join(__dirname, "..", "events");

  if (!fs.existsSync(eventsPath)) {
    return logger.warn(`La carpeta de eventos no existe en: ${eventsPath}`);
  }

  let loadedCount = 0;

  for (const file of getFiles(eventsPath)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const imported = await import(pathToFileURL(file).href);
      const event = imported.default ?? imported;

      if (!event?.name || typeof event.execute !== "function") {
        logger.warn(`El evento ${file} no es válido.`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      loadedCount++;
    } catch (error) {
      logger.error(`Ocurrió un error al cargar el evento ${file}: ${error}`);
    }
  }

  logger.info(`Se han cargado ${loadedCount} eventos correctamente.`);
}
