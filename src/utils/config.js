import logger from "./logger.js";

const requiredEnvVars = ["DISCORD_TOKEN", "DATABASE_URL", "CLIENT_ID"];
const missingVars = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  }
}

if (missingVars.length > 0) {
  logger.error(
    `Faltan las siguientes variables de entorno: ${missingVars.join(", ")}`,
  );
  process.exit(1);
}