const nodemailer = require('nodemailer');
const bookingRepository = require('../repositories/bookingRepository');
const { generateCSV } = require('../utils/csvGenerator');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function verifyEmailTransport() {
  try {
    await transporter.verify();
    console.log('✅ Email Server is ready!');
  } catch (err) {
    console.error('❌ Email Server verification failed:', err.message);
    throw err;
  }
}

async function sendReportEmail({ email, csv, filters }) {
  let csvData = csv;

  if ((!csvData || csvData.split('\n').length < 2) && filters) {
    const bookings = await bookingRepository.findBookings(filters);
    csvData = await generateCSV(bookings);
  }

  if (!csvData || csvData.split('\n').length < 2) {
    throw new Error('No report data available');
  }

  await transporter.sendMail({
    from: `"Mnet-Drops" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Cab Booking Report',
    text: 'Please find attached the booking report.',
    attachments: [{
      filename: `cab_booking_report_${Date.now()}.csv`,
      content: csvData,
      contentType: 'text/csv'
    }]
  });

  return { success: true };
}

module.exports = {
  verifyEmailTransport,
  sendReportEmail,
};