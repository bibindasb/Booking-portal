// Modern script.js with animations and enhanced features
document.addEventListener('DOMContentLoaded', function() {
  // User menu toggle
  const userMenuButton = document.getElementById('userMenuButton');
  const userMenu = document.getElementById('userMenu');
  
  if (userMenuButton && userMenu) {
    userMenuButton.addEventListener('click', () => {
      userMenu.classList.toggle('hidden');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target) && e.target !== userMenuButton) {
        userMenu.classList.add('hidden');
      }
    });
  }

// Check for admin session
function checkAdminSession() {
  return sessionStorage.getItem('admin') === 'true';
}

// In your login form submission handler:
if (username === 'admin' && password === 'admin123') { // Replace with secure auth in production
  sessionStorage.setItem('admin', 'true');
  window.location.href = 'admin.html';
}
      
      // Add loading state
      const submitButton = loginForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.innerHTML;
      submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
      submitButton.disabled = true;
      
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simple validation (replace with real auth in production)
      if (username && password && location) {
        sessionStorage.setItem('location', location);
        sessionStorage.setItem('username', username);
        
        // Add success animation
        submitButton.innerHTML = '<i class="fas fa-check"></i> Success!';
        submitButton.classList.remove('bg-primary');
        submitButton.classList.add('bg-green-500');
        
        // Redirect after delay
        setTimeout(() => {
          window.location.href = 'booking.html';
        }, 800);
      } else {
        // Show error
        submitButton.innerHTML = 'Authentication Failed';
        submitButton.classList.remove('bg-primary');
        submitButton.classList.add('bg-red-500');
        
        // Reset button after delay
        setTimeout(() => {
          submitButton.innerHTML = originalButtonText;
          submitButton.classList.remove('bg-red-500');
          submitButton.classList.add('bg-primary');
          submitButton.disabled = false;
        }, 1500);
      }
    });
  }

  // Booking Page Functionality
  if (document.getElementById('bookingForm')) {
    const location = sessionStorage.getItem('location');
    const username = sessionStorage.getItem('username');
    
    // Set user location in header
    const locationBadge = document.getElementById('userLocation');
    if (locationBadge) {
      locationBadge.textContent = location.charAt(0).toUpperCase() + location.slice(1);
    }
    
    // Set user avatar initial
    const userAvatar = document.querySelector('#userMenuButton .rounded-full');
    if (userAvatar && username) {
      userAvatar.textContent = username.charAt(0).toUpperCase();
    }
    
    // Sample data
    const cityData = {
      bangalore: ['Bangalore City', 'Whitefield', 'Electronic City', 'Marathahalli', 'Koramangala', 'Indiranagar'],
      mumbai: ['Mumbai City', 'Andheri', 'Bandra', 'Thane', 'Dadar', 'Powai', 'Vashi']
    };
    
    const timeSlotData = {
      bangalore: ['8:00 PM', '8:45 PM', '9:30 PM', '10:30 PM'],
      mumbai: ['9:30 PM', '10:30 PM', '11:30 PM', '12:30 AM', '1:30 AM', '2:30 AM', '5:30 AM', '7:30 AM']
    };
    
    // Populate cities dropdown with animation
    const citySelect = document.getElementById('city');
    if (citySelect) {
      cityData[location].forEach((city, index) => {
        setTimeout(() => {
          const option = document.createElement('option');
          option.value = city;
          option.textContent = city;
          citySelect.appendChild(option);
        }, index * 100);
      });
    }
    
    // Populate time slots dropdown with animation
    const timeSelect = document.getElementById('timeSlot');
    if (timeSelect) {
      timeSlotData[location].forEach((time, index) => {
        setTimeout(() => {
          const option = document.createElement('option');
          option.value = time;
          option.textContent = time;
          timeSelect.appendChild(option);
        }, index * 100);
      });
    }
    
    // Handle booking submission
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
      bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const city = document.getElementById('city').value;
        const time = document.getElementById('timeSlot').value;
        const submitButton = bookingForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        
        // Show loading state
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        submitButton.disabled = true;
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // Show success
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Booked Successfully!';
        submitButton.classList.remove('bg-primary');
        submitButton.classList.add('bg-green-500');
        
        // Add to recent bookings
        addRecentBooking(city, time);
        
        // Reset form after delay
        setTimeout(() => {
          submitButton.innerHTML = originalButtonText;
          submitButton.classList.remove('bg-green-500');
          submitButton.classList.add('bg-primary');
          submitButton.disabled = false;
          bookingForm.reset();
        }, 2000);
      });
    }
    
    // Update getAvailableTimeSlots
function getAvailableTimeSlots() {
  const location = sessionStorage.getItem('location').toLowerCase();
  const now = new Date();
  
  return config[location].timeSlots.filter(slot => {
    const [time, period] = slot.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    // Convert to 24h format
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);
    
    // Handle next day
    if (slotTime < now) slotTime.setDate(slotTime.getDate() + 1);
    
    // 3 hour buffer
    return (slotTime - now) > 3 * 60 * 60 * 1000;
  });
}
    
    // Populate recent bookings (mock data)
    function addRecentBooking(city, time) {
      const bookingsTable = document.getElementById('recentBookings');
      if (!bookingsTable) return;
      
      const newRow = document.createElement('tr');
      newRow.className = 'hover:bg-gray-50 transition';
      
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      
      newRow.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${formattedDate}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${city}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${time}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            Confirmed
          </span>
        </td>
      `;
      
      bookingsTable.prepend(newRow);
      
      // Add animation
      newRow.style.opacity = '0';
      newRow.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        newRow.style.transition = 'all 0.3s ease';
        newRow.style.opacity = '1';
        newRow.style.transform = 'translateY(0)';
      }, 10);
    }
    
    // Add some sample recent bookings
    if (location === 'bangalore') {
      addRecentBooking('Whitefield', '8:00 PM');
      addRecentBooking('Electronic City', '9:30 PM');
    } else {
      addRecentBooking('Andheri', '10:30 PM');
      addRecentBooking('Bandra', '11:30 PM');
    }
  }
});