const schedule = require('node-schedule');
const { Booking } = require('../models/Booking');
const { generateCSV } = require('./csvGenerator');
const { sendReportEmail } = require('../services/emailService');

async function scheduleBookingReport(booking) {
  try {
    const [time, period] = booking.timeSlot.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    const bookingDay = new Date(booking.travelDate);
    bookingDay.setHours(hours, minutes, 0, 0);

    const cutoffTime = new Date(bookingDay.getTime() - 3 * 60 * 60 * 1000); // 3 hour cutoff

    const jobName = `report-${bookingDay.toISOString().split('T')[0]}-${booking.timeSlot.replace(/[: ]/g, '_')}`;

    if (schedule.scheduledJobs[jobName] || cutoffTime < new Date()) {
      return;
    }

    schedule.scheduleJob(jobName, cutoffTime, async () => {
      const startOfDay = new Date(booking.travelDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const bookings = await Booking.find({
        travelDate: { $gte: startOfDay, $lt: endOfDay },
        timeSlot: booking.timeSlot,
        status: 'confirmed'
      });

      if (bookings.length === 0) return;

      const csv = await generateCSV(bookings);

      await sendReportEmail({
        email: process.env.AUTO_REPORT_EMAIL,
        csv
      });

      console.log(`✅ Report Email sent for slot: ${booking.timeSlot}`);
    });

    console.log(`⏰ Scheduled job: ${jobName}`);
  } catch (error) {
    console.error('Scheduler error:', error.message);
  }
}

async function rescheduleExistingBookings() {
  const bookings = await Booking.find({
    reportSent: false,
    travelDate: { $gt: new Date() }
  });

  const bookingGroups = {};

  for (const booking of bookings) {
    const key = `${booking.travelDate.toISOString().split('T')[0]}-${booking.timeSlot}`;
    bookingGroups[key] = booking;
  }
  
  for (const key in bookingGroups) {
    await scheduleBookingReport(bookingGroups[key]);
  }

  console.log(`✅ Rescheduled ${Object.keys(bookingGroups).length} jobs successfully.`);
}

module.exports = {
  scheduleBookingReport,
  rescheduleExistingBookings,
};