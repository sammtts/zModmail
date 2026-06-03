const teamsByGuildCache = new Map();
const teamByIdCache = new Map();

export function getTeamsCache(guildId) {
  return teamsByGuildCache.get(guildId);
}

export function setTeamsCache(guildId, teams) {
  teamsByGuildCache.set(guildId, teams);
  for (const team of teams) {
    teamByIdCache.set(team.id, team);
  }
}

export function getSingleTeamCache(teamId) {
  return teamByIdCache.get(teamId);
}

export function setSingleTeamCache(teamId, team) {
  teamByIdCache.set(teamId, team);
}

export function deleteTeamsCache(guildId) {
  const teams = teamsByGuildCache.get(guildId);
  if (teams) {
    for (const team of teams) {
      teamByIdCache.delete(team.id);
    }
  }
  teamsByGuildCache.delete(guildId);
}
