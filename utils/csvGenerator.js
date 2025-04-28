async function generateCSV(bookings) {
  let csv = 'Date,Time Slot,Location,Employee ID,Destination,Status\n';
  bookings.forEach(booking => {
    const dateStr = new Date(booking.travelDate).toLocaleDateString('en-IN');
    csv += `${dateStr},${booking.timeSlot},${booking.location},${booking.employeeId},${booking.destination},${booking.status}\n`;
  });
  return csv;
}

module.exports = { generateCSV };