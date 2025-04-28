const mongoose = require('mongoose');

const LocationConfigSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  timeSlots: { type: [String], default: [] },
  destinations: { type: [String], default: [] }
});

const LocationConfig = mongoose.model('LocationConfig', LocationConfigSchema);

// Initialize Default Locations if missing
async function initializeDefaultConfigs() {
  try {
    const defaultConfigs = [
      {
        name: 'bangalore',
        timeSlots: ['8:00 AM', '12:00 PM', '4:00 PM', '8:00 PM'],
        destinations: ['Bangalore Airport', 'Manyata Tech Park', 'Electronic City']
      },
      {
        name: 'mumbai',
        timeSlots: ['9:00 AM', '1:00 PM', '5:00 PM', '9:00 PM'],
        destinations: ['Mumbai Airport', 'Bandra Kurla Complex', 'Andheri East', 'Andheri']
      }
    ];

    for (const config of defaultConfigs) {
      const exists = await LocationConfig.findOne({ name: config.name });
      if (!exists) {
        await LocationConfig.create(config);
        console.log(`✅ Default config initialized for ${config.name}`);
      }
    }
  } catch (error) {
    console.error('❌ Error initializing default location configs:', error.message);
  }
}

module.exports = { LocationConfig, initializeDefaultConfigs };