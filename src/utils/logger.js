import fs from "node:fs";
import path from "node:path";

import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";
const logsDir = path.resolve(process.cwd(), "logs");
fs.mkdirSync(logsDir, { recursive: true });

const logFilePath = path.join(logsDir, "app.log");

const transportTargets = [
  {
    level: "info",
    target: "pino/file",
    options: {
      destination: logFilePath,
    },
  },
];

if (isDevelopment) {
  transportTargets.push({
    level: "debug",
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname",
      singleLine: false,
    },
  });
}

const logger = pino(
  {
    level: "info",
  },
  pino.transport({
    targets: transportTargets,
  }),
);

export default logger;
