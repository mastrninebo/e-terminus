// admin/assets/js/login.js
console.log("External login.js loaded successfully");

// Password visibility toggle
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded in external script");
    
    // Password visibility toggle
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // Form submission
    document.getElementById('adminLoginForm').addEventListener('submit', async function(e) {
        console.log("Form submitted via external script");
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        const loginButton = document.getElementById('loginButton');
        
        // Disable button and show loading state
        loginButton.disabled = true;
        loginButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Logging in...';
        
        // Hide previous alerts
        const alertElement = document.getElementById('loginAlert');
        alertElement.classList.add('d-none');
        
        try {
            const response = await fetch('/e-terminus/api/auth/login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    remember: rememberMe
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Store token
                localStorage.setItem('auth_token', data.token);
                
                // Check if user is admin
                if (data.user.user_type === 'admin' || data.user.is_admin) {
                    // Show success notification
                    showSuccessNotification('Login successful! Redirecting to Admin Dashboard...');
                    
                    // Redirect to admin dashboard after a short delay
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                } else {
                    // Not an admin
                    showAlert('You do not have admin privileges');
                    // Reset button state
                    loginButton.disabled = false;
                    loginButton.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login';
                }
            } else {
                showAlert(data.error || 'Login failed');
                // Reset button state
                loginButton.disabled = false;
                loginButton.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login';
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('An error occurred during login');
            // Reset button state
            loginButton.disabled = false;
            loginButton.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login';
        }
    });

    // Check if already logged in
    checkAuthStatus();
});

// Show success notification
function showSuccessNotification(message) {
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification-success';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto dismiss after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        notification.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            if (notificationContainer.contains(notification)) {
                notificationContainer.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Show alert message
function showAlert(message) {
    const alertElement = document.getElementById('loginAlert');
    alertElement.textContent = message;
    alertElement.classList.remove('d-none');
}

// Check if already logged in
async function checkAuthStatus() {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    
    try {
        const response = await fetch('/e-terminus/api/auth/check_session.php', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated && data.user && (data.user.user_type === 'admin' || data.user.is_admin)) {
                // Already logged in as admin, redirect to dashboard
                window.location.href = 'dashboard.html';
            }
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}