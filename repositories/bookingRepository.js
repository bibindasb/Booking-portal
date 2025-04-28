const { Booking } = require('../models/Booking');

async function findBookingById(id) {
  return Booking.findById(id);
}

async function findBookings(filter = {}) {
  return Booking.find(filter).sort({ travelDate: -1 });
}

async function createBooking(data) {
  return Booking.create(data);
}

async function updateBookingStatus(id, status) {
  return Booking.findByIdAndUpdate(id, { status }, { new: true });
}

module.exports = {
  findBookingById,
  findBookings,
  createBooking,
  updateBookingStatus
};