import { db } from "../database/db.js";

const configCache = new Map();

export async function getGuildConfig(guildId) {
  let config = configCache.get(guildId);
  if (!config) {
    config = await db.guildConfig.findUnique({ where: { id: guildId } });
    if (config) {
      configCache.set(guildId, config);
    }
  }
  return config;
}

export async function upsertGuildConfig(guildId) {
  let config = await getGuildConfig(guildId);

  if (!config) {
    config = await db.guildConfig.create({ data: { id: guildId } });
    configCache.set(guildId, config);
  }
  return config;
}

export async function updateAlertChannel(guildId, channelId) {
  const updated = await db.guildConfig.update({
    where: { id: guildId },
    data: { alertChannel: channelId },
  });
  configCache.set(guildId, updated);
  return updated;
}

export async function updateTranscriptChannel(guildId, channelId) {
  const updated = await db.guildConfig.update({
    where: { id: guildId },
    data: { transcriptChannel: channelId },
  });
  configCache.set(guildId, updated);
  return updated;
}

export async function updatePanelConfig(guildId, data) {
  const updated = await db.guildConfig.update({
    where: { id: guildId },
    data,
  });
  configCache.set(guildId, updated);
  return updated;
}
