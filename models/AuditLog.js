const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true  // e.g., 'login', 'config_update', 'booking_update'
  },
  target: {
    type: String     // optional: URL, route name, or specific entity
  },
  details: {
    type: Object     // any relevant metadata (status, request body, etc.)
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Export the Mongoose model
module.exports = mongoose.model('AuditLog', auditLogSchema);