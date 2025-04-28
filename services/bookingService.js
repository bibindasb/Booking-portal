const { Booking } = require('../models/Booking');
const bookingRepository = require('../repositories/bookingRepository');

/**
 * Create Booking
 */
async function createBooking({ employeeId, location, destination, timeSlot, travelDate }) {
  const travelDateObj = new Date(travelDate);
  
  const startOfDay = new Date(travelDateObj);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const existingBooking = await bookingRepository.findBookings({
    employeeId: employeeId,
    status: 'confirmed',
    travelDate: { $gte: startOfDay, $lt: endOfDay }
  });

  if (existingBooking.length > 0) {
    throw new Error('You already have an active booking for this day.');
  }

  const newBooking = await bookingRepository.createBooking({
    employeeId,
    location,
    destination,
    timeSlot,
    travelDate: travelDateObj
  });

  return newBooking;
}

/**
 * Cancel Booking
 */
async function cancelBooking(bookingId) {
  const booking = await bookingRepository.findBookingById(bookingId);
  if (!booking) throw new Error('Booking not found.');
  if (booking.status === 'cancelled') {
    throw new Error('Booking already cancelled.');
  }

  const istOptions = { timeZone: 'Asia/Kolkata' };
  const istDateStr = booking.travelDate.toLocaleDateString('en-CA', istOptions);

  const [timePart, ampm] = booking.timeSlot.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);
  
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  const slotDateTime = new Date(`${istDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+05:30`);
  const cutoffUTC = new Date(slotDateTime.getTime() - (3 * 60 * 60 * 1000)); // 3 hours before slot

  if (Date.now() > cutoffUTC) {
    throw new Error('Cancellation is no longer allowed after cutoff time.');
  }

  const updatedBooking = await bookingRepository.updateBookingStatus(bookingId, 'cancelled');
  return updatedBooking;
}

/**
 * Get Bookings
 */
async function getBookings({ employeeId, location, date }) {
  const query = {};

  if (employeeId) query.employeeId = employeeId;
  if (location) query.location = location;
  
  if (date) {
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    query.travelDate = { $gte: startDate, $lt: endDate };
  }

  return Booking.find(query).sort({ travelDate: -1 });
}

module.exports = {
  createBooking,
  cancelBooking,
  getBookings // ✅ Now properly exported because it exists!
};