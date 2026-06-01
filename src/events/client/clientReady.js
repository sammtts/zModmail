import logger from '../../utils/logger.js';

export default {
  name: 'clientReady',
  once: true,

  async execute(client) {
    logger.info(`Conectado como ${client.user.tag}`);
  },
};
