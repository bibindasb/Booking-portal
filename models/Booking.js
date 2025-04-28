const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  location: { type: String, required: true },
  destination: { type: String, required: true },
  timeSlot: { type: String, required: true },
  travelDate: { type: Date, required: true },
  bookingDate: { type: Date, default: Date.now },
  reportSent: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled'],
    default: 'confirmed'
  }
});

const Booking = mongoose.model('Booking', BookingSchema);

module.exports = { Booking };