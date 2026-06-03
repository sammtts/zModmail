import { getConfigCache, setConfigCache } from "../cache/configCache.js";
import { db } from "../database/db.js";

export async function getGuildConfig(guildId) {
  let config = getConfigCache(guildId);
  if (!config) {
    config = await db.guildConfig.findUnique({ where: { id: guildId } });
    if (config) {
      setConfigCache(guildId, config);
    }
  }
  return config;
}

export async function upsertGuildConfig(guildId) {
  let config = await getGuildConfig(guildId);

  if (!config) {
    config = await db.guildConfig.create({ data: { id: guildId } });
    setConfigCache(guildId, config);
  }
  return config;
}

export async function updateAlertChannel(guildId, channelId) {
  const updated = await db.guildConfig.update({
    where: { id: guildId },
    data: { alertChannel: channelId },
  });
  setConfigCache(guildId, updated);
  return updated;
}

export async function updateTranscriptChannel(guildId, channelId) {
  const updated = await db.guildConfig.update({
    where: { id: guildId },
    data: { transcriptChannel: channelId },
  });
  setConfigCache(guildId, updated);
  return updated;
}

export async function updatePanelConfig(guildId, data) {
  const updated = await db.guildConfig.update({
    where: { id: guildId },
    data,
  });
  setConfigCache(guildId, updated);
  return updated;
}
