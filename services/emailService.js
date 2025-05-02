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

async function sendBookingConfirmationEmail(email, booking) {
  const message = {
    from: process.env.SMTP_USER,
    to: email,
    subject: '🚖 Cab Booking Confirmation',
    html: `
      <h2 style="color:#0c4a6e;">Your Cab Booking is Confirmed!</h2>
      <p>Hello <strong>${booking.employeeId}</strong>,</p>

      <p>Here are your booking details:</p>

      <table style="border-collapse: collapse; margin-top: 10px;">
        <tr><td><strong>🎯 Destination:</strong></td><td>${booking.destination}</td></tr>
        <tr><td><strong>📅 Travel Date:</strong></td><td>${new Date(booking.travelDate).toLocaleDateString()}</td></tr>
        <tr><td><strong>⏰ Time Slot:</strong></td><td>${booking.timeSlot}</td></tr>
      </table>

      <p style="margin-top: 20px;">Please be ready on time. Thank you for using the cab booking system!</p>

      <hr style="margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">This is an automated email. If you didn’t make this booking, please contact your administrator.</p>
    `
  };

  try {
    console.log(`[MAIL] Sending confirmation to ${email}...`);
    const info = await transporter.sendMail(message);
    console.log(`[MAIL] Email sent: ${info.messageId || info.response}`);
  } catch (err) {
    console.error(`[MAIL] Failed to send email to ${email}`, err.message);
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
  sendBookingConfirmationEmail
};