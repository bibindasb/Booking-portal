const { LocationConfig } = require('../models/LocationConfig');

async function getAllConfigs() {
  const configs = await LocationConfig.find();
  const configMap = {};

  configs.forEach(config => {
    configMap[config.name] = {
      timeSlots: config.timeSlots,
      destinations: config.destinations
    };
  });

  return configMap;
}

module.exports = {
  getAllConfigs,
};