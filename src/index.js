import "dotenv/config";
import "./utils/config.js";

import { Client, GatewayIntentBits, Partials } from "discord.js";

import loadCommands from "./handlers/commandHandler.js";
import loadEvents from "./handlers/eventHandler.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

await loadEvents(client);
await loadCommands(client);

client.login(process.env.DISCORD_TOKEN);
