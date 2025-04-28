const locationConfigRepository = require('../repositories/locationConfigRepository');

async function getConfigs() {
  return locationConfigRepository.getAllConfigs();
}

module.exports = {
  getConfigs,
};