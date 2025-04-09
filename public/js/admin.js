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

window.emailReport = async function () {
  try {
    const email = document.getElementById('reportEmail').value;
    const location = document.getElementById('reportLocation').value;
    const date = document.getElementById('reportDate').value;

    if (!email || !email.includes('@')) {
      showAdminAlert('Please enter a valid email address', 'error');
      return;
    }

    showAdminAlert('Generating report...', 'info');

    // Build query params
    let url = '/api/bookings';
    const params = new URLSearchParams();
    if (location) params.append('location', location);
    if (date) params.append('date', date);
    if (params.toString()) url += `?${params.toString()}`;

    const bookingsRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    if (!bookingsRes.ok) {
      throw new Error('Failed to fetch bookings');
    }

    const bookings = await bookingsRes.json();

    if (!bookings || bookings.length === 0) {
      showAdminAlert('No bookings found for selected filters', 'warning');
      return;
    }

    // Generate CSV string
    let csv = 'Date,Employee ID,Destination,Time Slot,Status\n';
    bookings.forEach(booking => {
      const dateStr = new Date(booking.travelDate).toLocaleDateString();
      csv += `"${dateStr}","${booking.employeeId}","${booking.destination}","${booking.timeSlot}","${booking.status}"\n`;
    });

    if (!csv || csv.trim().length === 0) {
      throw new Error('Generated CSV is empty');
    }

    // Send CSV to backend
    showAdminAlert('Sending report via email...', 'info');

    const sendRes = await fetch('/api/send-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({
        email,
        csv,
        filters: {
          ...(location && { location }),
          ...(date && { date }),
        }
      })
    });
    
    if (!sendRes.ok) {
      const errorText = await sendRes.text();
      throw new Error(errorText);
    }

    showAdminAlert('Email report sent successfully!', 'success');

  } catch (error) {
    console.error('Email error:', error);
    showAdminAlert(error.message || 'Failed to send report', 'error');
  }
};

document.addEventListener('DOMContentLoaded', async function () {
  let adminConfig = {
    bangalore: { timeSlots: [], destinations: [] },
    mumbai: { timeSlots: [], destinations: [] }
  };

  const token = localStorage.getItem('adminToken');
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
      throw new Error('Admin access required');
    }

    await loadDashboard();
  } catch (error) {
    console.error('Admin error:', error);
    logoutAdmin();
  }

  async function loadDashboard() {
    try {
      const [configRes, bookingsRes] = await Promise.all([
        fetch('/api/config', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/bookings', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (!configRes.ok || !bookingsRes.ok) throw new Error('Failed to load data');

      const newConfig = await configRes.json();
      const bookings = await bookingsRes.json();

      adminConfig = {
        bangalore: newConfig.bangalore || { timeSlots: [], destinations: [] },
        mumbai: newConfig.mumbai || { timeSlots: [], destinations: [] }
      };

      renderConfig(adminConfig);
      renderBookings(bookings);
    } catch (error) {
      showAdminAlert(`Dashboard Error: ${error.message}`, 'error');
    }
  }

  window.addTimeSlot = async (location) => {
    try {
      const capitalizedLocation = location.charAt(0).toUpperCase() + location.slice(1);
      const input = document.getElementById(`new${capitalizedLocation}Time`);
      const time = input.value.trim();

      if (!time) {
        showAdminAlert('Please enter a valid time', 'error');
        return;
      }

      const current = adminConfig[location];
      const newTimeSlots = [...current.timeSlots, time];

      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          location,
          timeSlots: newTimeSlots,
          destinations: current.destinations
        })
      });

      const data = await response.json();
      adminConfig[location] = data[location.toLowerCase()];
      renderConfig(adminConfig);
      input.value = '';
      showAdminAlert('Time slot added successfully', 'success');
    } catch (error) {
      console.error('Add time error:', error);
      showAdminAlert(error.message, 'error');
    }
  };

  window.removeTimeSlot = async (location, index) => {
    try {
      const current = adminConfig[location];
      const newTimeSlots = current.timeSlots.filter((_, i) => i !== index);

      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          location,
          timeSlots: newTimeSlots,
          destinations: current.destinations
        })
      });

      const data = await response.json();
      adminConfig[location] = data[location.toLowerCase()];
      renderConfig(adminConfig);
      showAdminAlert('Time slot removed successfully', 'success');
    } catch (error) {
      console.error('Remove time error:', error);
      showAdminAlert(error.message, 'error');
    }
  };

  window.addDestination = async (location) => {
    try {
      const capitalizedLocation = location.charAt(0).toUpperCase() + location.slice(1);
      const input = document.getElementById(`new${capitalizedLocation}Destination`);
      const destination = input.value.trim();

      if (!destination) {
        showAdminAlert('Please enter a destination', 'error');
        return;
      }

      const current = adminConfig[location];
      const newDestinations = [...current.destinations, destination];

      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          location,
          timeSlots: current.timeSlots,
          destinations: newDestinations
        })
      });

      const data = await response.json();
      adminConfig[location] = data[location.toLowerCase()];
      renderConfig(adminConfig);
      input.value = '';
      showAdminAlert('Destination added successfully', 'success');
    } catch (error) {
      console.error('Add destination error:', error);
      showAdminAlert(error.message, 'error');
    }
  };

  window.removeDestination = async (location, index) => {
    try {
      const current = adminConfig[location];
      const newDestinations = current.destinations.filter((_, i) => i !== index);

      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          location,
          timeSlots: current.timeSlots,
          destinations: newDestinations
        })
      });

      const data = await response.json();
      adminConfig[location] = data[location.toLowerCase()];
      renderConfig(adminConfig);
      showAdminAlert('Destination removed successfully', 'success');
    } catch (error) {
      console.error('Remove destination error:', error);
      showAdminAlert(error.message, 'error');
    }
  };

  window.filterBookings = async () => {
    try {
      const location = document.getElementById('bookingFilterLocation').value;
      const date = document.getElementById('bookingFilterDate').value;

      const params = new URLSearchParams();
      if (location) params.append('location', location);
      if (date) params.append('date', date);

      const response = await fetch(`/api/bookings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch bookings');

      const bookings = await response.json();
      renderBookings(bookings);
      showAdminAlert(`Found ${bookings.length} bookings`, 'success');
    } catch (error) {
      console.error('Filter error:', error);
      showAdminAlert(error.message, 'error');
    }
  };

  window.generateReport = async () => {
    try {
      const location = document.getElementById('reportLocation').value;
      const date = document.getElementById('reportDate').value;

      showAdminAlert('Generating report...', 'info');

      let url = '/api/bookings';
      const params = new URLSearchParams();
      if (location) params.append('location', location);
      if (date) params.append('date', date);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch bookings');

      const bookings = await response.json();

      if (bookings.length === 0) {
        showAdminAlert('No bookings found for selected filters', 'warning');
        return;
      }

      let csv = 'Date,Employee ID,Destination,Time Slot,Status\n';
      bookings.forEach(booking => {
        const dateStr = new Date(booking.travelDate).toLocaleDateString();
        csv += `${dateStr},${booking.employeeId},${booking.destination},${booking.timeSlot},${booking.status}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const urlObject = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObject;
      a.download = `cab_bookings_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showAdminAlert('Report generated successfully!', 'success');
    } catch (error) {
      console.error('Report error:', error);
      showAdminAlert(error.message, 'error');
    }
  };

  window.adminUpdateBooking = async (bookingId, status) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) throw new Error(`Failed to ${status} booking`);

      await loadDashboard();
      showAdminAlert(`Booking ${status} successfully`, 'success');
    } catch (error) {
      console.error(`Update booking error:`, error);
      showAdminAlert(error.message, 'error');
    }
  };

  function renderConfig(config) {
    ['bangalore', 'mumbai'].forEach(location => {
      const timeList = document.getElementById(`${location}TimeSlotsList`);
      const destList = document.getElementById(`${location}DestinationsList`);

      if (timeList) {
        timeList.innerHTML = (config[location]?.timeSlots || []).map((time, index) => `
          <div class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center m-1">
            ${time}
            <button onclick="removeTimeSlot('${location}', ${index})"
              class="ml-2 text-blue-500 hover:text-blue-700">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>
        `).join('');
      }

      if (destList) {
        destList.innerHTML = (config[location]?.destinations || []).map((dest, index) => `
          <div class="bg-green-100 text-green-800 px-3 py-2 rounded-lg flex justify-between items-center m-1">
            ${dest}
            <button onclick="removeDestination('${location}', ${index})"
              class="text-green-600 hover:text-green-800">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `).join('');
      }
    });
  }

  function renderBookings(bookings) {
    const bookingsList = document.getElementById('adminBookingsList');
    bookingsList.innerHTML = '';

    if (bookings.length === 0) {
      bookingsList.innerHTML = '<p class="text-gray-500 p-4">No bookings match the filters</p>';
      return;
    }

    bookings.forEach(booking => {
      const bookingElement = document.createElement('div');
      bookingElement.className = 'border rounded-lg p-4 mb-3 bg-white shadow-sm';
      bookingElement.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h3 class="font-medium text-gray-900">${booking.destination}</h3>
            <p class="text-sm text-gray-500 mt-1">
              ${new Date(booking.travelDate).toLocaleDateString('en-IN')} 
              at ${booking.timeSlot}
            </p>
            <div class="mt-2">
              <span class="inline-block px-2 py-1 text-xs font-medium rounded-full ${
                booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                'bg-yellow-100 text-yellow-800'
              }">
                ${booking.status}
              </span>
              <span class="ml-2 text-sm text-gray-500">
                ${booking.employeeId}
              </span>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            ${booking.status !== 'cancelled' ? `
              <button onclick="adminUpdateBooking('${booking._id}', 'cancelled')" 
                class="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 border rounded-lg">
                Cancel
              </button>` : ''}
            ${booking.status === 'pending' ? `
              <button onclick="adminUpdateBooking('${booking._id}', 'confirmed')" 
                class="text-green-600 hover:text-green-800 text-sm font-medium px-3 py-1 border rounded-lg">
                Confirm
              </button>` : ''}
          </div>
        </div>
      `;
      bookingsList.appendChild(bookingElement);
    });
  }

  window.logoutAdmin = function () {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin.html";
  };
});