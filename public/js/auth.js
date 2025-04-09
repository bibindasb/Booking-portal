// Handle login form submission
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const location = document.getElementById('location').value;

  if (!username || !password || !location) {
    showError('All fields are required');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, isAdmin: false })
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('token', data.token); // Add this line
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('location', location.toLowerCase());
      window.location.href = 'booking.html';
    } else {
      showError(data.message || 'Login failed');
    }
  } catch (error) {
    showError('Network error. Please try again.');
  }
});

// Handle admin login
document.getElementById('adminLoginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const username = document.getElementById('adminUsername').value;
  const password = document.getElementById('adminPassword').value;
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, isAdmin: true })
    });
    
    const data = await response.json();
    
    if (data.success && data.isAdmin) {
      localStorage.setItem('adminToken', data.token); // Store admin token
      window.location.href = '/admin/dashboard';
    } else {
      showError(data.message || 'Admin login failed');
    }
  } catch (error) {
    showError('Network error. Please try again.');
  }
});

function showError(message) {
  const errorElement = document.createElement('div');
  errorElement.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
  errorElement.textContent = message;
  
  const form = document.querySelector('form');
  form.prepend(errorElement);
  
  setTimeout(() => {
    errorElement.remove();
  }, 5000);
}