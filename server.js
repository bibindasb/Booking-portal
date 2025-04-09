require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const schedule = require('node-schedule');
const validator = require('validator');

const app = express();

// Ensure you have this transporter configuration
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


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cabbooking', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Models
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
  bookingDate: { type: Date, default: Date.now },
  travelDate: { type: Date, required: true },
  reportSent: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['confirmed', 'cancelled'], // Remove 'pending'
    default: 'confirmed' // Auto-confirm bookings
  }
});

const LocationConfig = mongoose.model('LocationConfig', LocationConfigSchema);
const Booking = mongoose.model('Booking', BookingSchema);

// Admin Credentials
const ADMIN_CREDS = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASS || 'admin123'
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Initialize Default Configurations
async function initializeDefaultConfigs() {
  try {
    const bangaloreExists = await LocationConfig.exists({ name: 'bangalore' });
    const mumbaiExists = await LocationConfig.exists({ name: 'mumbai' });

    if (!bangaloreExists) {
      await LocationConfig.create({
        name: 'bangalore',
        timeSlots: ['8:00 AM', '12:00 PM', '4:00 PM', '8:00 PM'],
        destinations: ['Bangalore Airport', 'Manyata Tech Park', 'Electronic City']
      });
    }

    if (!mumbaiExists) {
      await LocationConfig.create({
        name: 'mumbai',
        timeSlots: ['9:00 AM', '1:00 PM', '5:00 PM', '9:00 PM'],
        destinations: ['Mumbai Airport', 'Bandra Kurla Complex', 'Andheri East', 'Andheri']
      });
    }
  } catch (error) {
    console.error('Error initializing default configurations:', error);
  }
}

// Generate JWT Token
function generateToken(user, isAdmin = false) {
  return jwt.sign(
    { userId: user, isAdmin },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Verify JWT Token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Authentication Middleware
function authenticateUser(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });

  req.user = decoded;
  next();
}

function authenticateAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const decoded = verifyToken(token);
  if (!decoded || !decoded.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.user = decoded;
  next();
}

// Routes

// Login
app.post('/api/login', async (req, res) => {
  const { username, password, isAdmin } = req.body;
  
  try {
    if (isAdmin) {
      if (username === ADMIN_CREDS.username && password === ADMIN_CREDS.password) {
        const token = generateToken(username, true);
        return res.json({ success: true, token, isAdmin: true });
      }
      return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
    }
    
    // For regular users (replace with your actual user authentication)
    if (username && password) {
      const token = generateToken(username);
      return res.json({ success: true, token });
    }
    
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
    
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, error: 'Authentication error' });
  }
});

// Configurations
app.get('/api/config', async (req, res) => {
  try {
    const configs = await LocationConfig.find();
    const configMap = {};
    configs.forEach(config => {
      configMap[config.name] = {
        timeSlots: config.timeSlots,
        destinations: config.destinations
      };
    });
    res.json(configMap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enhanced Config Endpoint
app.post('/api/config', authenticateAdmin, async (req, res) => {
  try {
    const { location, timeSlots, destinations } = req.body;
    
    // Validate input
    if (!location || !Array.isArray(timeSlots) || !Array.isArray(destinations)) {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    // Update configuration
    const updatedConfig = await LocationConfig.findOneAndUpdate(
      { name: location.toLowerCase() },
      { timeSlots, destinations },
      { 
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    res.json({
      [location.toLowerCase()]: {
        timeSlots: updatedConfig.timeSlots,
        destinations: updatedConfig.destinations
      }
    });
    
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({ error: 'Configuration update failed' });
  }
});

// Enhanced Verify Token Endpoint
app.get('/api/verify-token', authenticateAdmin, (req, res) => {
  res.json({ isAdmin: true });
});

// Bookings
app.get('/api/bookings', authenticateUser, async (req, res) => {
  try {
    const { location, date, employeeId } = req.query;
    let query = {};
    
    if (employeeId) query.employeeId = employeeId;
    if (location) query.location = location;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      query.travelDate = { $gte: startDate, $lt: endDate };
    }
    
    const bookings = await Booking.find(query).sort({ travelDate: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings', authenticateUser, async (req, res) => {
  try {
    const { employeeId, location, destination, timeSlot, travelDate } = req.body;
    
    // Validate inputs
    if (!employeeId || !location || !destination || !timeSlot || !travelDate) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Convert to IST timezone for accurate comparison
    const istOptions = { timeZone: "Asia/Kolkata" };
    const nowIST = new Date().toLocaleString("en-US", istOptions);
    const currentIST = new Date(nowIST);

    // Parse booking time slot in IST
    const [time, period] = timeSlot.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    
    // Convert to 24-hour format
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    // Create booking datetime in IST
    const bookingDateIST = new Date(travelDate);
    bookingDateIST.setHours(hours, minutes, 0, 0);
    
    // Compare with current IST time
    if (bookingDateIST < currentIST) {
      return res.status(400).json({ 
        error: 'Cannot book past time slots. Please choose a future time.' 
      });
    }
    
    // Validate travel date
    const selectedDate = new Date(travelDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      return res.status(400).json({ error: 'Travel date cannot be in the past' });
    }
    
    // Check for existing booking
    const startDate = new Date(travelDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    const existingBooking = await Booking.findOne({
      employeeId,
      travelDate: { $gte: startDate, $lt: endDate },
      status: 'confirmed' // Only check for confirmed bookings
    });
    
    if (existingBooking) {
      return res.status(400).json({ error: 'You already have a booking for this date' });
    }
    
    // Create and save booking
    const booking = new Booking({ 
      employeeId, 
      location, 
      destination, 
      timeSlot,
      travelDate: selectedDate
    });

    const savedBooking = await booking.save();
    
    // Schedule report AFTER successful save
    scheduleBookingReport(savedBooking);
    
    res.json({ success: true, booking: savedBooking });

  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

app.put('/api/bookings/:id/status', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

        // Only allow cancellation
        if (status !== 'cancelled') {
          return res.status(400).json({ error: 'Only cancellation is allowed' });
        }
    
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (status === 'cancelled') {
      // Calculate cutoff time in UTC
      const travelDate = booking.travelDate;
      const istDateStr = travelDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const [time, period] = booking.timeSlot.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      
      // Convert to 24-hour format
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      // Create slot time in IST and convert to UTC
      const slotTimeIST = new Date(`${istDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+05:30`);
      const cutoffTimeUTC = new Date(slotTimeIST.getTime() - 3 * 60 * 60 * 1000);

      // Check against current UTC time
      if (Date.now() > cutoffTimeUTC) {
        return res.status(400).json({ error: 'Cancellation is not allowed after cutoff time' });
      }
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    
    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CSV generation and email sending
async function generateCSV(bookings) {
  // Remove "async" if not needed (if no await inside)
  let csv = 'Date,Time Slot,Location,Employee ID,Destination,Status\n';
  bookings.forEach(booking => {
    const dateStr = new Date(booking.travelDate).toLocaleDateString('en-IN');
    csv += `${dateStr},${booking.timeSlot},${booking.location},`;
    csv += `${booking.employeeId},${booking.destination},${booking.status}\n`;
  });
  return csv; // Now returns string directly
}

// Scheduled report function
async function scheduleBookingReport(booking) {
  try {
    const istOptions = { timeZone: "Asia/Kolkata" };

    const [time, period] = booking.timeSlot.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    const slotTime = new Date(
      booking.travelDate.toLocaleString("en-US", istOptions)
    );
    slotTime.setHours(hours, minutes, 0, 0);

    const cutoffTime = new Date(slotTime.getTime() - 3 * 60 * 60 * 1000);

    console.log("\n--- Scheduling Debug ---");
    console.log(
      "Booking Time (IST):",
      slotTime.toLocaleString("en-US", istOptions)
    );
    console.log(
      "Cutoff Time (IST):",
      cutoffTime.toLocaleString("en-US", istOptions)
    );
    console.log(
      "Current Server Time (IST):",
      new Date().toLocaleString("en-US", istOptions)
    );

    if (cutoffTime < Date.now()) {
      console.log(`Skipping past booking (IST): ${booking._id}`);
      return;
    }

    const istDateStr = slotTime.toLocaleDateString("en-CA", istOptions); // YYYY-MM-DD
    const jobName = `report-${istDateStr}-${booking.timeSlot.replace(/[: ]/g, "_")}`;

    if (schedule.scheduledJobs[jobName]) {
      console.log(`Job ${jobName} already scheduled`);
      return;
    }

    const job = schedule.scheduleJob(jobName, cutoffTime, async () => {
      try {
        console.log(
          `[${new Date().toLocaleString(
            "en-US",
            istOptions
          )}] Job triggered: ${jobName}`
        );

        const startOfDay = new Date(slotTime);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        console.log(
          "Query Range (IST):",
          startOfDay.toLocaleString("en-US", istOptions),
          "-",
          endOfDay.toLocaleString("en-US", istOptions)
        );

        const bookings = await Booking.find({
          travelDate: { $gte: startOfDay, $lt: endOfDay },
          timeSlot: booking.timeSlot,
          status: 'confirmed' // Only include confirmed bookings
        });

        if (bookings.length === 0) {
          console.log(
            `No bookings found for ${istDateStr} ${booking.timeSlot}`
          );
          return;
        }

        console.log(`Found ${bookings.length} bookings for report`);
        console.log(`Sending to: ${process.env.AUTO_REPORT_EMAIL}`);
        console.log(`Using email auth: ${process.env.EMAIL_USER}`);

        // Verify email transport
        try {
          await transporter.verify();
          console.log("Email server is ready");
        } catch (err) {
          console.error("Email transport error:", err);
          return;
        }

        const csvData = await generateCSV(bookings);

        await transporter.sendMail({
          from: `"Mnet-Drops" <${process.env.EMAIL_FROM}>`,
          to: process.env.AUTO_REPORT_EMAIL,
          subject: `[Report] ${booking.timeSlot} Bookings on ${istDateStr}`,
          text: `Report for ${booking.timeSlot} bookings:\n` +
            `Total Bookings: ${bookings.length}\n` +
            `Location: ${booking.location}\n` +
            `Cutoff Time: ${cutoffTime.toLocaleString("en-US", istOptions)}`,
            attachments: [{
              filename: `report_${istDateStr}_${booking.timeSlot.replace(/[: ]/g, '_')}.csv`,
              content: csvData, // Should be string/buffer
              contentType: 'text/csv'
            }]
          });

        console.log(`✅ Report email sent successfully.`);
      } catch (error) {
        console.error("Job execution error:", error);
      }
    });

    console.log(`Scheduled job successfully: ${jobName}`);
  } catch (error) {
    console.error("Scheduling error:", error);
  }
}
// Update send-report endpoint
app.post('/api/send-report', authenticateAdmin, async (req, res) => {
  try {
    const { email, csv, filters } = req.body;

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    let csvData = csv;

    if ((!csvData || csvData.split('\n').length < 2) && filters) {
      const bookings = await Booking.find(filters);
      csvData = generateCSV(bookings);
    }

    if (!csvData || csvData.split('\n').length < 2) {
      // Not enough rows
      return res.status(400).json({ error: 'No report data provided' });
    }

    await transporter.sendMail({
      from: `"Mnet-Drops" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Cab Booking Report',
      text: 'Please find attached the cab booking report.',
      attachments: [{
        filename: `cab_report_${Date.now()}.csv`,
        content: csvData,
        contentType: 'text/csv'
      }]
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to send report' });
  }
});

// Add before other routes
app.get('/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"Test" <${process.env.EMAIL_FROM}>`,
      to: process.env.AUTO_REPORT_EMAIL,
      subject: 'Test Email',
      text: 'This is a test email'
    });
    res.send('Test email sent');
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).send(error.message);
  }
});


// Serve admin dashboard
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Serve admin login page
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Initialize and Start Server
const PORT = process.env.PORT || 3000;

async function rescheduleExistingBookings() {
  try {
    const bookings = await Booking.find({ 
      reportSent: false,
      travelDate: { $gt: new Date() }
    });

    const bookingGroups = {};
    bookings.forEach(booking => {
      const date = new Date(booking.travelDate);
      const dateStr = date.toISOString().split('T')[0];
      const key = `${dateStr}-${booking.timeSlot}`;
      if (!bookingGroups[key]) {
        bookingGroups[key] = [];
      }
      bookingGroups[key].push(booking);
    });

    Object.keys(bookingGroups).forEach(key => {
      const [dateStr, timeSlot] = key.split('-', 2);
      const sampleBooking = bookingGroups[key][0]; // One booking just to get info

      const [time, period] = sampleBooking.timeSlot.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      const slotTime = new Date(dateStr);
      slotTime.setHours(hours, minutes, 0, 0);

      const cutoffTime = new Date(slotTime.getTime() - (3 * 60 * 60 * 1000));

      const jobName = `report-${dateStr}-${timeSlot.replace(/ /g, '_')}`;
      if (schedule.scheduledJobs[jobName] || cutoffTime < Date.now()) {
        return;
      }

      // ✅ fix: loop bookings inside job
      schedule.scheduleJob(jobName, cutoffTime, async () => {
        const group = bookingGroups[key];
        for (const booking of group) {
          scheduleBookingReport(booking);
        }
      });
    });

    console.log(`Rescheduled ${Object.keys(bookingGroups).length} report jobs`);
  } catch (error) {
    console.error('Rescheduling error:', error);
  }
}

// Update server startup
async function startServer() {
  await initializeDefaultConfigs();
  await rescheduleExistingBookings();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();