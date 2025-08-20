class LoginSystem {
    constructor() {
        this.loginForm = document.getElementById('loginForm');
        this.apiUrl = 'http://localhost/e-terminus/api/auth/login.php';
        this.rateLimitNotice = document.getElementById('rateLimitNotice');
        this.retryAfterElement = document.getElementById('retryAfter');
        
        this.initEventListeners();
        this.checkExistingSession();
        this.checkRateLimited();
    }
    
    initEventListeners() {
        // Password visibility toggle
        document.querySelectorAll('.password-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                const input = e.currentTarget.previousElementSibling;
                const icon = e.currentTarget.querySelector('i');
                input.type = input.type === 'password' ? 'text' : 'password';
                icon.classList.toggle('fa-eye-slash');
                icon.classList.toggle('fa-eye');
            });
        });
        
        // Form submission
        this.loginForm.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Demo account quick fill (remove in production)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'd' && e.ctrlKey) {
                document.getElementById('loginEmail').value = 'demo@eterminus.com';
                document.getElementById('loginPassword').value = 'Demo@1234';
                this.showAlert('info', 'Demo credentials filled', false);
            }
        });
    }
    
    async checkExistingSession() {
        try {
            const response = await fetch('/api/auth/session', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.redirectUser(data.user);
            }
        } catch (error) {
            console.debug('No active session found');
        }
    }
    
    checkRateLimited() {
        const rateLimitedUntil = localStorage.getItem('rateLimitedUntil');
        if (rateLimitedUntil && new Date(rateLimitedUntil) > new Date()) {
            this.showRateLimitNotice(rateLimitedUntil);
        }
    }
    
    showRateLimitNotice(untilDate) {
        const until = new Date(untilDate);
        const minutes = Math.ceil((until - new Date()) / (1000 * 60));
        
        this.retryAfterElement.textContent = minutes;
        this.rateLimitNotice.style.display = 'block';
        this.loginForm.querySelector('button[type="submit"]').disabled = true;
        
        // Update countdown every minute
        const timer = setInterval(() => {
            const remaining = Math.ceil((until - new Date()) / (1000 * 60));
            if (remaining <= 0) {
                clearInterval(timer);
                this.rateLimitNotice.style.display = 'none';
                this.loginForm.querySelector('button[type="submit"]').disabled = false;
                localStorage.removeItem('rateLimitedUntil');
            } else {
                this.retryAfterElement.textContent = remaining;
            }
        }, 60000);
    }
    
    async handleSubmit(event) {
        event.preventDefault();
        
        // Validate form
        if (!this.loginForm.checkValidity()) {
            this.loginForm.classList.add('was-validated');
            return;
        }
        
        const formData = {
            email: document.getElementById('loginEmail').value.trim(),
            password: document.getElementById('loginPassword').value,
            remember: document.getElementById('rememberMe').checked
        };
        
        try {
            const response = await this.sendLoginRequest(formData);
            this.handleLoginResponse(response);
        } catch (error) {
            console.error('Login error:', error);
            this.showAlert('danger', error.message || 'Network error. Please try again.');
        }
    }
    
    async sendLoginRequest(formData) {
        const submitBtn = this.loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        
        // Set loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Logging in...
        `;
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            return {
                ok: response.ok,
                status: response.status,
                data: data,
                headers: response.headers
            };
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
    
    handleLoginResponse(response) {
        if (response.ok) {
            this.handleSuccessfulLogin(response.data);
        } else {
            this.handleLoginError(response);
        }
    }
    
    handleSuccessfulLogin(data) {
        // Store token if "Remember me" was checked
        if (document.getElementById('rememberMe').checked) {
            localStorage.setItem('auth_token', data.token);
        }
        
        // Show success message
        this.showAlert('success', 'Login successful! Redirecting...', false);
        
        // Redirect user
        this.redirectUser(data.user);
    }
    
    redirectUser(user) {
        let redirectPath = '/';
        
        // Custom redirect paths based on user type
        if (user.user_type === 'admin') {
            redirectPath = '/admin/dashboard.html';
        } else if (user.user_type === 'operator') {
            redirectPath = '/operator/dashboard.html';
        } else if (user.user_type === 'passenger') {
            redirectPath = 'http://localhost/e-terminus/public/index.html';
        }

        
        // Small delay for UX
        setTimeout(() => {
            window.location.href = redirectPath;
        }, 1500);
    }
    
    handleLoginError(response) {
        let errorMessage = 'Login failed. Please try again.';
        
        switch (response.status) {
            case 400:
                errorMessage = 'Invalid email or password format';
                break;
            case 401:
                errorMessage = 'Invalid email or password';
                break;
            case 403:
                errorMessage = response.data?.error || 'Account not verified';
                if (response.data?.error?.includes('verified')) {
                    errorMessage += '<br><a href="/resend-verification" class="alert-link">Resend verification email</a>';
                }
                break;
            case 429:
                errorMessage = 'Too many attempts. Try again later.';
                const retryAfter = response.headers.get('Retry-After') || 15;
                const until = new Date(Date.now() + retryAfter * 60 * 1000);
                localStorage.setItem('rateLimitedUntil', until.toISOString());
                this.showRateLimitNotice(until.toISOString());
                break;
            case 500:
                errorMessage = 'Server error. Please try again later.';
                break;
        }
        
        this.showAlert('danger', errorMessage);
        
        // Shake form for UX
        this.loginForm.classList.add('animate__animated', 'animate__headShake');
        setTimeout(() => {
            this.loginForm.classList.remove('animate__animated', 'animate__headShake');
        }, 1000);
    }
    
    showAlert(type, message, autoDismiss = true) {
        const alertContainer = document.getElementById('alertContainer');
        const alertId = 'alert-' + Date.now();
        
        const alertDiv = document.createElement('div');
        alertDiv.id = alertId;
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                          type === 'info' ? 'fa-info-circle' : 
                          'fa-exclamation-triangle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        alertContainer.appendChild(alertDiv);
        
        // Auto-dismiss after 5 seconds if enabled
        if (autoDismiss) {
            setTimeout(() => {
                const alertElement = document.getElementById(alertId);
                if (alertElement) {
                    const bsAlert = bootstrap.Alert.getOrCreateInstance(alertElement);
                    bsAlert.close();
                }
            }, 5000);
        }
    }
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new LoginSystem();
});