// ===========================
// ADMIN DASHBOARD FRONTEND
// ===========================

// Show alert message
function showAdminAlert(message, type) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert ${type}`;
  alertDiv.innerHTML = `
    <i class="fas ${
      type === 'error' ? 'fa-exclamation-circle' :
      type === 'success' ? 'fa-check-circle' :
      'fa-info-circle'
    } mr-2"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(alertDiv);
  setTimeout(() => {
    alertDiv.style.animation = 'fadeOut 0.5s ease-out forwards';
    setTimeout(() => alertDiv.remove(), 500);
  }, 5000);
}

// Show/hide loading spinner
function showLoader(show = true) {
  let loader = document.getElementById('loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'loader';
    loader.className = 'fixed top-0 left-0 w-full h-full flex justify-center items-center bg-white/60 z-50';
    loader.innerHTML = `
      <div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12"></div>
    `;
    document.body.appendChild(loader);
  }
  loader.style.display = show ? 'flex' : 'none';
}

// Auto create loading spinner CSS
const css = `
@keyframes spinner {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.loader {
  border-top-color: #3498db;
  animation: spinner 1s linear infinite;
}
`;
const style = document.createElement('style');
style.appendChild(document.createTextNode(css));
document.head.appendChild(style);

// Dashboard Variables
let adminConfig = {};
const token = localStorage.getItem('adminToken');

// Refresh FULL admin config from server
async function refreshAdminConfig() {
  showLoader(true);
  try {
    const res = await fetch('/api/config', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const newConfig = await res.json();
    adminConfig = {
      bangalore: newConfig.bangalore || { timeSlots: [], destinations: [] },
      mumbai: newConfig.mumbai || { timeSlots: [], destinations: [] }
    };
    renderConfig(adminConfig);
  } catch (err) {
    console.error('Error refreshing config:', err);
    showAdminAlert('Failed to reload config', 'error');
  } finally {
    showLoader(false);
  }
}

// Handle login protection
document.addEventListener('DOMContentLoaded', async function () {
  const currentPage = window.location.pathname;
  const protectedPages = ['/admin-dashboard.html'];
  const isProtectedPage = protectedPages.some(page => currentPage.includes(page));

  if (!token && isProtectedPage) {
    window.location.href = 'admin.html';
    return;
  }
  
  try {
    const verification = await fetch('/api/verify-token', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await verification.json();
    if (!verification.ok || !result.isAdmin) {
      throw new Error('Admin access denied');
    }
    await loadDashboard();
  } catch (err) {
    console.error(err);
    logoutAdmin();
  }
});

// Update loadDashboard to use filters
async function loadDashboard() {
  showLoader(true);
  try {
    await Promise.all([
      refreshAdminConfig(),
      loadBookings() // Load with current filters (today's date)
    ]);
  } catch (err) {
    console.error('Dashboard loading failed:', err);
  } finally {
    showLoader(false);
  }
}

async function loadBookings() {
  try {
    const location = document.getElementById('bookingFilterLocation').value;
    const dateInput = document.getElementById('bookingFilterDate').value;
    
    // Convert to ISO format (YYYY-MM-DD)
    const isoDate = dateInput ? new Date(dateInput).toISOString().split('T')[0] : '';

    const params = new URLSearchParams();
    if (location) params.append('location', location);
    if (isoDate) params.append('date', isoDate);

    const res = await fetch(`/api/bookings?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Failed to fetch bookings');
    const bookings = await res.json();
    renderBookings(bookings);
  } catch (err) {
    console.error('Bookings load error:', err);
    showAdminAlert(err.message, 'error');
  }
}

// Capture add-time
window.addTimeSlot = async (location) => {
  const inputId = `new${capitalize(location)}Time`;
  const input = document.getElementById(inputId);
  const time = input.value.trim();
  if (!time) return showAdminAlert('Please enter a valid time', 'error');
  
  showLoader(true);
  try {
    const current = adminConfig[location];
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        location,
        timeSlots: [...current.timeSlots, time],
        destinations: current.destinations
      })
    });
    input.value = '';
    showAdminAlert('Time slot added!', 'success');
    await refreshAdminConfig();
  } catch (err) {
    console.error('Add time error:', err);
    showAdminAlert(err.message, 'error');
  } finally {
    showLoader(false);
  }
};

// Capture remove-time
window.removeTimeSlot = async (location, index) => {
  showLoader(true);
  try {
    const current = adminConfig[location];
    const newTimeSlots = current.timeSlots.filter((_, i) => i !== index);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        location,
        timeSlots: newTimeSlots,
        destinations: current.destinations
      })
    });
    showAdminAlert('Time slot removed!', 'success');
    await refreshAdminConfig();
  } catch (err) {
    console.error('Remove time error:', err);
    showAdminAlert(err.message, 'error');
  } finally {
    showLoader(false);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const filter = document.getElementById('logTypeFilter');
  const search = document.getElementById('logSearch');
  
  if (filter) {
    filter.addEventListener('change', () => {
      loadAuditLogs(); // Reload logs with selected filter
    });
  }

  if (search) {
    search.addEventListener('input', () => {
      loadAuditLogs();
    });
  }

  // Initial load
  loadAuditLogs();
});

// Capture add-destination
window.addDestination = async (location) => {
  const inputId = `new${capitalize(location)}Destination`;
  const input = document.getElementById(inputId);
  const destination = input.value.trim();
  if (!destination) return showAdminAlert('Please enter a destination', 'error');
  
  showLoader(true);
  try {
    const current = adminConfig[location];
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        location,
        timeSlots: current.timeSlots,
        destinations: [...current.destinations, destination]
      })
    });
    input.value = '';
    showAdminAlert('Destination added!', 'success');
    await refreshAdminConfig();
  } catch (err) {
    console.error('Add destination error:', err);
    showAdminAlert(err.message, 'error');
  } finally {
    showLoader(false);
  }
};

// Capture remove-destination
window.removeDestination = async (location, index) => {
  showLoader(true);
  try {
    const current = adminConfig[location];
    const newDestinations = current.destinations.filter((_, i) => i !== index);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        location,
        timeSlots: current.timeSlots,
        destinations: newDestinations
      })
    });
    showAdminAlert('Destination removed!', 'success');
    await refreshAdminConfig();
  } catch (err) {
    console.error('Remove destination error:', err);
    showAdminAlert(err.message, 'error');
  } finally {
    showLoader(false);
  }
};

// Helper: capitalize string
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Render Config
function renderConfig(config) {
  ['bangalore', 'mumbai'].forEach(location => {
    const timeList = document.getElementById(`${location}TimeSlotsList`);
    const destList = document.getElementById(`${location}DestinationsList`);
    if (!timeList || !destList) return;

    // Time slots rendering remains same
    timeList.innerHTML = (config[location]?.timeSlots || []).map((time, idx) => `
      <div class="flex items-center space-x-2 py-1">
        <span>${time}</span>
        <button onclick="removeTimeSlot('${location}', ${idx})" class="text-red-600 hover:text-red-800 text-sm">
          ✖
        </button>
      </div>
    `).join('');

    // Modified destination rendering with data attributes
    destList.innerHTML = (config[location]?.destinations || []).map((dest, idx) => `
      <div class="flex items-center space-x-2 py-1" data-destination="${dest.toLowerCase()}">
        <span>${dest}</span>
        <button onclick="removeDestination('${location}', ${idx})" class="text-red-600 hover:text-red-800 text-sm">
          ✖
        </button>
      </div>
    `).join('');
  });
}

// Render bookings
function renderBookings(bookings) {
  const bookingsList = document.getElementById('adminBookingsList');
  bookingsList.innerHTML = '';

  if (!bookings.length) {
    bookingsList.innerHTML = '<p class="text-gray-500 p-4">No bookings found.</p>';
    return;
  }

  bookings.forEach(booking => {
    const bookingElement = document.createElement('div');
    bookingElement.className = 'border p-4 rounded-md mb-3';
    bookingElement.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <h4 class="font-medium">${booking.destination}</h4>
          <p class="text-sm text-gray-500">${new Date(booking.travelDate).toLocaleDateString()} at ${booking.timeSlot}</p>
          <p class="text-xs text-gray-400">${booking.employeeId}</p>
        </div>
        <div>
          ${booking.status !== 'cancelled' ? `
            <button onclick="adminUpdateBooking('${booking._id}', 'cancelled')" class="text-red-500">Cancel</button>
          ` : ''}
        </div>
      </div>
    `;
    bookingsList.appendChild(bookingElement);
  });
}

window.generateReport = async () => {
  showLoader(true);
  try {
    const location = document.getElementById('reportLocation').value;
    const date = document.getElementById('reportDate').value;

    const params = new URLSearchParams();
    if (location) params.append('location', location);
    if (date) params.append('date', date);

    let url = '/api/bookings';
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to fetch bookings');

    const bookings = await res.json();

    if (!bookings.length) {
      showAdminAlert('No bookings found for selected filters.', 'warning');
      return;
    }

    // Generate CSV
    let csv = 'Date,Employee ID,Destination,Time Slot,Status\n';
    bookings.forEach(booking => {
      const dateStr = new Date(booking.travelDate).toLocaleDateString();
      csv += `${dateStr},"${booking.employeeId}","${booking.destination}","${booking.timeSlot}","${booking.status}"\n`;
    });

    // Trigger browser file download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cab_bookings_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showAdminAlert('CSV report downloaded!', 'success');

  } catch (err) {
    console.error('Report download error:', err);
    showAdminAlert(err.message, 'error');
  } finally {
    showLoader(false);
  }
};

window.emailReport = async () => {
  showLoader(true);
  try {
    const location = document.getElementById('reportLocation').value;
    const date = document.getElementById('reportDate').value;
    const email = document.getElementById('reportEmail').value.trim();

    if (!email || !email.includes('@')) {
      showAdminAlert('Please enter a valid email', 'error');
      return;
    }

    const params = new URLSearchParams();
    if (location) params.append('location', location);
    if (date) params.append('date', date);

    let url = '/api/bookings';
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to fetch bookings');

    const bookings = await res.json();

    if (!bookings.length) {
      showAdminAlert('No bookings found for selected filters.', 'warning');
      return;
    }

    // Generate CSV
    let csv = 'Date,Employee ID,Destination,Time Slot,Status\n';
    bookings.forEach(booking => {
      const dateStr = new Date(booking.travelDate).toLocaleDateString();
      csv += `${dateStr},"${booking.employeeId}","${booking.destination}","${booking.timeSlot}","${booking.status}"\n`;
    });

    // Send report to server to email
    const sendRes = await fetch('/api/send-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        email,
        csv,
        filters: {
          ...(location && { location }),
          ...(date && { date })
        }
      })
    });

    if (!sendRes.ok) {
      const errorText = await sendRes.text();
      throw new Error(errorText || 'Failed to send email');
    }

    showAdminAlert('Report emailed successfully!', 'success');

  } catch (err) {
    console.error('Email report error:', err);
    showAdminAlert(err.message, 'error');
  } finally {
    showLoader(false);
  }
};

// Update booking status
window.adminUpdateBooking = async (id, status) => {
  showLoader(true);
  try {
    await fetch(`/api/bookings/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    await loadDashboard();
    showAdminAlert(`Booking ${status} successfully`, 'success');
  } catch (err) {
    console.error(`Update booking error:`, err);
    showAdminAlert(err.message, 'error');
  } finally {
    showLoader(false);
  }
};

// Initialize date filter to today when dashboard loads
document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('bookingFilterDate');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
});


document.addEventListener('DOMContentLoaded', () => {
  // Initialize destination filters
  const initDestinationFilters = () => {
    ['bangalore', 'mumbai'].forEach(location => {
      const searchId = `search${capitalize(location)}`;
      const searchInput = document.getElementById(searchId);
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          filterDestinations(location, e.target.value.trim());
        });
      }
    });
  };

  window.filterBookings = function() {
    loadBookings();
  };

  // Initial call
  initDestinationFilters();
});

function filterDestinations(location, query) {
  const destList = document.getElementById(`${location}DestinationsList`);
  if (!destList) return;

  const items = destList.querySelectorAll('[data-destination]');
  const searchTerm = query.toLowerCase();

  items.forEach(item => {
    const dest = item.dataset.destination;
    item.style.display = dest.includes(searchTerm) ? 'flex' : 'none';
  });
}

function formatLogDetails(action, details = {}) {
  if (!details || typeof details !== 'object') return '-';

  switch (action) {
    case 'login':
      const role = details.isAdmin ? 'Admin' : 'User';
      const method = details.method === 'local' ? 'Local Login' : 'Active Directory';
      return `Logged in as ${role} via ${method}`;

    case 'config_update':
      const location = details.location || 'unknown';
      const tsCount = details.changes?.timeSlots?.length || 0;
      const destCount = details.changes?.destinations?.length || 0;
      return `Updated config for ${location} (${tsCount} time slot${tsCount !== 1 ? 's' : ''}, ${destCount} destination${destCount !== 1 ? 's' : ''})`;

    case 'booking_update':
      return `Booking status changed to "${details.status || 'unknown'}"`;

    default:
      return Object.entries(details)
        .map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`)
        .join(', ');
  }
}

let currentLogPage = 1;
let totalLogs = 0;

async function loadAuditLogs(search = '', actionFilter = '') {
  showLoader(true);
  try {
    const params = new URLSearchParams({
      page: currentLogPage,
      limit: 50,
      ...(search && { search }),
      ...(actionFilter && { action: actionFilter })
    });

    const res = await fetch(`/api/audit-logs?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const { total, page, logs } = await res.json();
    totalLogs = total;
    renderAuditLogs(logs);
    updatePaginationInfo();

  } catch (err) {
    showAdminAlert('Failed to load logs', 'error');
  } finally {
    showLoader(false);
  }
}

async function loadAuditLogs(page = 1, limit = 50) {
  const action = document.getElementById('logTypeFilter')?.value || '';
  const search = document.getElementById('logSearch')?.value.trim();
  const queryParams = new URLSearchParams({ page, limit });

  if (action) queryParams.append('action', action);
  if (search) queryParams.append('search', search);

  try {
    const token = localStorage.getItem('adminToken');
    const res = await fetch(`/api/audit-logs?${queryParams.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    const tbody = document.getElementById('auditLogsList');
    tbody.innerHTML = '';

    if (data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No logs found</td></tr>';
    } else {
      for (const log of data.logs) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="px-4 py-2">${new Date(log.timestamp).toLocaleString()}</td>
          <td class="px-4 py-2">${log.user}</td>
          <td class="px-4 py-2">${log.action}</td>
          <td>${formatLogDetails(log.action, log.details)}</td>
        `;
        tbody.appendChild(tr);
      }
    }

    document.getElementById('logPaginationInfo').textContent =
      `Showing ${data.logs.length} of ${data.total} log entries`;

  } catch (err) {
    console.error('Failed to load audit logs', err);
  }
}

function renderAuditLogs(logs) {
  const container = document.getElementById('auditLogsList');
  container.innerHTML = logs.map(log => `
    <tr class="border-t">
      <td class="px-4 py-2">${new Date(log.timestamp).toLocaleString()}</td>
      <td class="px-4 py-2">${log.user}</td>
      <td class="px-4 py-2 capitalize">${log.action.replace('_', ' ')}</td>
      <td class="px-4 py-2 max-w-xs truncate">
        ${JSON.stringify(log.details || {})}
      </td>
    </tr>
  `).join('');
}

function updatePaginationInfo() {
  const info = document.getElementById('logPaginationInfo');
  const showing = currentLogPage * 50;
  info.textContent = `Showing ${showing > totalLogs ? totalLogs : showing} of ${totalLogs} logs`;
}

window.loadMoreLogs = function() {
  currentLogPage++;
  loadAuditLogs();
};

// Add to DOMContentLoaded event listener
document.getElementById('logSearch').addEventListener('input', (e) => {
  loadAuditLogs(e.target.value, document.getElementById('logTypeFilter').value);
});

document.getElementById('logTypeFilter').addEventListener('change', (e) => {
  loadAuditLogs(document.getElementById('logSearch').value, e.target.value);
});

// Logout
window.logoutAdmin = function () {
  localStorage.removeItem('adminToken');
  window.location.href = '/admin.html';
};
