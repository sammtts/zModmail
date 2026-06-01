import 'dotenv/config';

import { Client, GatewayIntentBits } from 'discord.js';

import loadCommands from './handlers/commandHandler.js';
import loadEvents from './handlers/eventHandler.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

await loadEvents(client);
await loadCommands(client);

if (!process.env.DISCORD_TOKEN) {
  console.error('El token de Discord no está definido en las variables de entorno.');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
