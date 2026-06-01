import { SlashCommandBuilder } from 'discord.js';

const pingCommand = {
  data: new SlashCommandBuilder().setName('ping').setDescription('test'),
  async execute(interaction) {
    await interaction.reply('Pong!');
  },
};

export default pingCommand;
