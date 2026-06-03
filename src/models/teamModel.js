import {
  deleteTeamsCache,
  getSingleTeamCache,
  getTeamsCache,
  setSingleTeamCache,
  setTeamsCache,
} from "../cache/teamCache.js";
import { db } from "../database/db.js";
import { upsertGuildConfig } from "./guildModel.js";

export async function getTeam(id) {
  const cached = getSingleTeamCache(id);
  if (cached) {
    return cached;
  }

  const team = await db.team.findUnique({ where: { id } });
  if (team) {
    setSingleTeamCache(id, team);
  }
  return team;
}

export async function getTeamsByGuild(guildId) {
  const cached = getTeamsCache(guildId);
  if (cached) {
    return cached;
  }

  const teams = await db.team.findMany({ where: { guildId } });
  setTeamsCache(guildId, teams);
  return teams;
}

export async function createTeam(guildId, name, roleId) {
  await upsertGuildConfig(guildId);
  const team = await db.team.create({
    data: { name, roleId, guildId },
  });

  deleteTeamsCache(guildId);
  return team;
}

export async function getVisibleTeamsByGuild(guildId) {
  const cached = getTeamsCache(guildId);
  if (cached) {
    return cached.filter((team) => team.isPanelVisible);
  }

  const teams = await db.team.findMany({
    where: { guildId, isPanelVisible: true },
  });
  return teams;
}

export async function setPanelTeams(guildId, visibleTeamIds) {
  await db.team.updateMany({
    where: { guildId },
    data: { isPanelVisible: false },
  });

  if (visibleTeamIds && visibleTeamIds.length > 0) {
    await db.team.updateMany({
      where: {
        guildId,
        id: { in: visibleTeamIds },
      },
      data: { isPanelVisible: true },
    });
  }

  deleteTeamsCache(guildId);
}

export async function deleteTeam(id) {
  const team = await getTeam(id);
  const guildId = team?.guildId;

  const result = await db.team.delete({ where: { id } });

  if (guildId) {
    deleteTeamsCache(guildId);
  }
  return result;
}

export async function updateTeam(id, data) {
  const team = await getTeam(id);
  const guildId = team?.guildId;

  const result = await db.team.update({
    where: { id },
    data,
  });

  if (guildId) {
    deleteTeamsCache(guildId);
  }
  return result;
}
