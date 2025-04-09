const mongoose = require('mongoose');

const LocationConfigSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  timeSlots: { type: [String], default: [] },
  destinations: { type: [String], default: [] }
});

const BookingSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  location: { type: String, required: true },
  destination: { type: String, required: true },
  timeSlot: { type: String, required: true },
  bookingDate: { type: Date, required: true, default: Date.now },
  status: { type: String, default: 'confirmed' }
});

module.exports = {
  LocationConfig: mongoose.model('LocationConfig', LocationConfigSchema),
  Booking: mongoose.model('Booking', BookingSchema)
};