const cache = new Map();

export function getConfigCache(guildId) {
  return cache.get(guildId);
}

export function setConfigCache(guildId, config) {
  cache.set(guildId, config);
}

export function deleteConfigCache(guildId) {
  cache.delete(guildId);
}
