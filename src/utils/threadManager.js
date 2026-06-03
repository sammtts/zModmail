import logger from "./logger.js";

export async function getThread(client, threadId) {
  try {
    return (
      client.channels.cache.get(threadId) ||
      (await client.channels.fetch(threadId))
    );
  } catch (error) {
    logger.warn(`No se pudo obtener el thread ${threadId}: ${error.message}`);
    return null;
  }
}
