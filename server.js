require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();

// Database and Models
const { connectDB } = require('./models/db');
const { Booking } = require('./models/Booking');
const { LocationConfig, initializeDefaultConfigs } = require('./models/LocationConfig');
const AuditLog = require('./models/AuditLog');

// Services
const bookingService = require('./services/bookingService');
const locationConfigService = require('./services/locationConfigService');
const { sendReportEmail, verifyEmailTransport } = require('./services/emailService');
const { scheduleBookingReport, rescheduleExistingBookings } = require('./utils/scheduler');

// Auth utilities
const { authenticateUser, authenticateAdmin, generateToken, verifyToken } = require('./utils/auth');
const { authenticateADUser, isUserInGroup } = require('./utils/adAuth');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Admin Credentials
const ADMIN_CREDS = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASS || 'admin123'
};

// ========================
// Routes
// ========================

// Modified login handler
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if user is the local admin
    if (
      username === ADMIN_CREDS.username &&
      password === ADMIN_CREDS.password
    ) {
      const token = generateToken(username, true); // local admin is always an admin
      const log = new AuditLog({
        user: username,
        action: 'login',
        details: { isAdmin: true, method: 'local' },
      });
      await log.save();
      return res.json({
        success: true,
        token,
        isAdmin: true,
        username,
      });
    }

    // Otherwise use AD authentication
    const authResult = await authenticateADUser(username, password);
    if (!authResult) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isAdmin = await isUserInGroup(username, process.env.AD_ADMIN_GROUP);

    const log = new AuditLog({
      user: username,
      action: 'login',
      details: { isAdmin, method: 'active_directory' },
    });
    await log.save();

    const token = generateToken(username, isAdmin);
    res.json({
      success: true,
      token,
      isAdmin,
      username,
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
});


// Test command for direct authentication
app.post('/api/test-auth', async (req, res) => {
  const { username, password } = req.body;
  
  ad.authenticate(username, password, (err) => {
    if (err) return res.status(401).json({ error: err.message });
    res.json({ success: true });
  });
});


// Verify Admin Token
app.get('/api/verify-token', authenticateAdmin, (req, res) => {
  res.json({ isAdmin: true });
});

async function logAction(req, action, details = {}) {
  if (!req.user) return;
  
  const log = new AuditLog({
    user: req.user.userId,
    action,
    target: req.originalUrl,
    details
  });
  
  await log.save();
}

// Config endpoints
// Config endpoints
app.get('/api/config', async (req, res) => {
  try {
    const configs = await locationConfigService.getConfigs();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config', authenticateAdmin, async (req, res) => {
  try {
    const { location, timeSlots, destinations } = req.body;
    if (!location || !Array.isArray(timeSlots) || !Array.isArray(destinations)) {
      return res.status(400).json({ error: 'Invalid configuration data' });
    }
    
    const updatedConfig = await LocationConfig.findOneAndUpdate(
      { name: location.toLowerCase() },
      { timeSlots, destinations },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    
    await logAction(req, 'config_update', {
      location,
      changes: { timeSlots, destinations }
    });

    res.json(updatedConfig);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});


// Audit endpoint
app.get('/api/audit-logs', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, search } = req.query;
    const filter = {};

    if (action) filter.action = action;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { user: regex },
        { action: regex },
        { target: regex }
      ];
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await AuditLog.countDocuments(filter);
    res.json({ total, logs });

  } catch (err) {
    console.error('Audit log fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Booking endpoints
app.post('/api/bookings', authenticateUser, async (req, res) => {
  try {
    const booking = await bookingService.createBooking(req.body);
    res.json({ success: true, booking });
  } catch (error) {
    if (error.message && (
         error.message.includes('already have an active booking') ||
         error.message.includes('Cancellation is no longer allowed')
    )) {
      res.status(400).json({ error: error.message });
    } else {
      console.error('Booking Critical Server Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

// PUT Cancel Booking
app.put('/api/bookings/:id/status', authenticateUser, async (req, res) => {
  try {
    const updatedBooking = await bookingService.cancelBooking(req.params.id);
    res.json({ success: true, booking: updatedBooking });
  } catch (error) {
    if (error.message && (
         error.message.includes('Cancellation is no longer allowed') ||
         error.message.includes('Booking already cancelled') ||
         error.message.includes('Booking not found')
    )) {
      res.status(400).json({ error: error.message });
    } else {
      console.error('Cancel Booking Critical Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

// GET Fetch Bookings
app.get('/api/bookings', authenticateUser, async (req, res) => {
  try {
    const { location, date } = req.query;
    const filter = {};

    if (!req.user.isAdmin) filter.employeeId = req.user.userId;
    if (location) filter.location = location;

    if (date) {
      // Parse date in UTC
      const startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setUTCHours(23, 59, 59, 999);

      // Use UTC dates for query
      filter.travelDate = { 
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString()
      };
    }

    const bookings = await Booking.find(filter).lean();
    res.json(bookings);
  } catch (error) {
    console.error('Fetch Bookings Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Report / Email
app.post('/api/send-report', authenticateAdmin, async (req, res) => {
  try {
    const { email, csv, filters } = req.body;
    if (!csv || !email) {
      return res.status(400).json({ error: 'Missing email or CSV data' });
    }

    const result = await sendReportEmail({ email, csv, filters });
    res.json(result);
  } catch (error) {
    console.error('Send report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Email test
app.get('/test-email', async (req, res) => {
  try {
    await sendReportEmail({
      email: process.env.AUTO_REPORT_EMAIL,
      csv: 'Test,Email\nHello,World\n'
    });
    res.send('Test Email sent successfully!');
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).send(error.message);
  }
});


// ========================
// Static Frontend Pages
// ========================

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Frontend fallback (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========================
// Server Start
// ========================

const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    await connectDB();
    console.log('✅ Database Connected.');
    
    await initializeDefaultConfigs();
    console.log('✅ Default Config Created.');
    
    await rescheduleExistingBookings();
    console.log('✅ Scheduled Jobs Ready.');

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Server Startup Error:', error);
    process.exit(1);
  }
}

startServer();