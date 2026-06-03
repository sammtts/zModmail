import { db } from "../database/db.js";

export async function getBlacklistUser(userId) {
  return db.blacklist.findUnique({ where: { userId } });
}

export async function getAllBlacklisted() {
  return db.blacklist.findMany();
}

export async function blacklistUser(userId, reason, addedBy) {
  return db.blacklist.upsert({
    where: { userId },
    update: { reason, addedBy },
    create: { userId, reason, addedBy },
  });
}

export async function removeBlacklist(userId) {
  return db.blacklist.delete({ where: { userId } });
}
