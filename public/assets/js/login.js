class LoginSystem {
    constructor() {
        this.loginForm = document.getElementById('loginForm');
        this.apiUrl = 'http://localhost/e-terminus/api/auth/login.php';
        this.rateLimitNotice = document.getElementById('rateLimitNotice');
        this.retryAfterElement = document.getElementById('retryAfter');
        this.emailInput = document.getElementById('loginEmail');
        this.passwordInput = document.getElementById('loginPassword');
        this.csrfTokenInput = document.getElementById('csrfToken');
        
        // Security tracking
        this.failedAttempts = 0;
        this.lastFailedAttempt = 0;
        this.accountLockouts = new Map(); // Simulating account lockout tracking
        
        this.initEventListeners();
        this.checkExistingSession();
        this.checkRateLimited();
        this.generateCSRFToken();
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
                
                // Update aria-label for accessibility
                const isVisible = input.type === 'text';
                e.currentTarget.setAttribute('aria-label', 
                    isVisible ? 'Hide password' : 'Show password');
            });
        });
        
        // Form submission
        this.loginForm.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Input validation on blur
        this.emailInput.addEventListener('blur', () => this.validateEmail());
        this.passwordInput.addEventListener('blur', () => this.validatePassword());
        
        // Input validation on input (clear errors when user types)
        this.emailInput.addEventListener('input', () => {
            if (this.emailInput.classList.contains('is-invalid')) {
                this.emailInput.classList.remove('is-invalid');
            }
        });
        
        this.passwordInput.addEventListener('input', () => {
            if (this.passwordInput.classList.contains('is-invalid')) {
                this.passwordInput.classList.remove('is-invalid');
            }
        });
        
        // Resend verification link
        document.getElementById('resendVerificationLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.resendVerification();
        });
    }
    
    generateCSRFToken() {
        // Generate a simple CSRF token (in a real app, this should come from the server)
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        this.csrfTokenInput.value = token;
        sessionStorage.setItem('csrf_token', token);
    }
    
    validateEmail() {
        const email = this.emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email) {
            this.showFieldError(this.emailInput, 'Please enter your email address');
            return false;
        }
        
        if (!emailRegex.test(email)) {
            this.showFieldError(this.emailInput, 'Please enter a valid email address');
            return false;
        }
        
        this.hideFieldError(this.emailInput);
        return true;
    }
    
    validatePassword() {
        const password = this.passwordInput.value;
        
        if (!password) {
            this.showFieldError(this.passwordInput, 'Please enter your password');
            return false;
        }
        
        // Generic error message to avoid giving hints
        if (password.length < 8) {
            this.showFieldError(this.passwordInput, 'Please check your credentials');
            return false;
        }
        
        this.hideFieldError(this.passwordInput);
        return true;
    }
    
    showFieldError(input, message) {
        input.classList.add('is-invalid');
        const validationElement = input.parentElement.nextElementSibling;
        if (validationElement && validationElement.classList.contains('validation-feedback')) {
            validationElement.textContent = message;
            validationElement.style.display = 'block';
        }
    }
    
    hideFieldError(input) {
        input.classList.remove('is-invalid');
        const validationElement = input.parentElement.nextElementSibling;
        if (validationElement && validationElement.classList.contains('validation-feedback')) {
            validationElement.style.display = 'none';
        }
    }
    
    // Check if account is temporarily locked out
    isAccountLocked(email) {
        const lockoutKey = `lockout_${btoa(email)}`;
        const lockoutUntil = localStorage.getItem(lockoutKey);
        
        if (lockoutUntil && new Date().getTime() < parseInt(lockoutUntil)) {
            const minutesLeft = Math.ceil((parseInt(lockoutUntil) - new Date().getTime()) / 60000);
            this.showAlert('warning', `Account temporarily locked. Try again in ${minutesLeft} minutes.`);
            return true;
        }
        
        return false;
    }
    
    // Lock account for a period
    lockAccount(email, minutes = 15) {
        const lockoutKey = `lockout_${btoa(email)}`;
        const lockoutUntil = new Date().getTime() + (minutes * 60000);
        localStorage.setItem(lockoutKey, lockoutUntil.toString());
    }
    
    async checkExistingSession() {
        try {
            const response = await fetch('http://localhost/e-terminus/api/auth/check_session.php', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.authenticated) {
                    this.redirectUser(data.user);
                }
            }
        } catch (error) {
            // Silent fail - user just needs to log in
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
        
        // Validate form fields
        const isEmailValid = this.validateEmail();
        const isPasswordValid = this.validatePassword();
        
        if (!isEmailValid || !isPasswordValid) {
            this.loginForm.classList.add('was-validated');
            return;
        }
        
        const email = this.emailInput.value.trim();
        
        // Check if account is locked
        if (this.isAccountLocked(email)) {
            return;
        }
        
        const formData = {
            email: email,
            password: this.passwordInput.value,
            remember: document.getElementById('rememberMe').checked,
            csrf_token: this.csrfTokenInput.value
        };
        
        try {
            const response = await this.sendLoginRequest(formData);
            this.handleLoginResponse(response, formData.email);
        } catch (error) {
            console.error('Login error:', error);
            this.showAlert('danger', 'Authentication failed. Please try again.');
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
            
            // Clone the response so we can read it multiple times
            const responseClone = response.clone();
            
            // Try to get the response as text first
            let responseText;
            try {
                responseText = await response.text();
            } catch (e) {
                console.error('Error reading response text:', e);
                responseText = '';
            }
            
            // Try to parse as JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('Error parsing JSON response:', e);
                console.log('Response text:', responseText);
                data = { error: 'Invalid server response' };
            }
            
            return {
                ok: response.ok,
                status: response.status,
                data: data,
                headers: response.headers,
                responseText: responseText
            };
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
    
    handleLoginResponse(response, email) {
        if (response.ok) {
            // Reset failed attempts on successful login
            this.failedAttempts = 0;
            this.handleSuccessfulLogin(response.data);
        } else {
            this.failedAttempts++;
            this.handleLoginError(response, email);
        }
    }
    
    handleSuccessfulLogin(data) {
        // Store token if "Remember me" was checked
        if (document.getElementById('rememberMe').checked) {
            localStorage.setItem('auth_token', data.token);
        }
        
        // Store user data in localStorage for immediate access
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        // Show success message
        this.showAlert('success', 'Login successful! Redirecting...', false);
        
        // Redirect user
        this.redirectUser(data.user);
    }
    
    redirectUser(user) {
        const baseUrl = window.location.origin;
        let redirectPath = `${baseUrl}/e-terminus/index.html`;
        
        // Custom redirect paths based on user type
        if (user.user_type === 'admin') {
            redirectPath = `${baseUrl}/e-terminus/admin/dashboard.html`;
        } else if (user.user_type === 'operator') {
            redirectPath = `${baseUrl}/e-terminus/operator/dashboard.html`;
        }
        
        // Small delay for UX
        setTimeout(() => {
            window.location.href = redirectPath;
        }, 1500);
    }
    
    handleLoginError(response, email) {
        console.log('Handling login error:', response);
        
        let errorMessage = 'Authentication failed. Please check your credentials.';
        
        // Check if we have a specific error message in the response data
        if (response.data && response.data.error) {
            errorMessage = response.data.error;
        } 
        // If no error message but we have response text, try to extract from there
        else if (response.responseText) {
            try {
                const textData = JSON.parse(response.responseText);
                if (textData.error) {
                    errorMessage = textData.error;
                }
            } catch (e) {
                // Not JSON, check if it's HTML or plain text
                if (response.responseText.includes('error')) {
                    // Try to extract error message from HTML
                    const match = response.responseText.match(/<[^>]*error[^>]*>([^<]*)/i);
                    if (match && match[1]) {
                        errorMessage = match[1].trim();
                    }
                }
            }
        }
        
        // Handle specific HTTP status codes
        switch (response.status) {
            case 400:
            case 401:
                // Authentication failed - use more specific message if available
                if (errorMessage === 'Authentication failed. Please check your credentials.' || 
                    errorMessage === 'Invalid server response') {
                    errorMessage = 'Invalid email or password. Please try again.';
                }
                
                // Implement account lockout after multiple failed attempts
                if (this.failedAttempts >= 5) {
                    this.lockAccount(email, 15);
                    errorMessage = 'Too many failed attempts. Account temporarily locked for 15 minutes.';
                }
                break;
            case 403:
                // Account not verified or other forbidden access
                if (errorMessage.includes('verified') || errorMessage.includes('verification')) {
                    errorMessage += '<br><a href="#" onclick="loginSystem.resendVerification(\'' + email + '\'); return false;" class="alert-link">Resend verification email</a>';
                }
                break;
            case 429:
                // Rate limited
                errorMessage = 'Too many login attempts. Please try again later.';
                const retryAfter = response.headers.get('Retry-After') || 15;
                const until = new Date(Date.now() + retryAfter * 60 * 1000);
                localStorage.setItem('rateLimitedUntil', until.toISOString());
                this.showRateLimitNotice(until.toISOString());
                break;
            case 500:
                // Server error - show more user-friendly message
                if (errorMessage === 'Invalid server response' || 
                    errorMessage === 'Authentication failed. Please check your credentials.') {
                    errorMessage = 'Login service temporarily unavailable. Please try again later.';
                }
                break;
        }
        
        console.log('Final error message:', errorMessage);
        this.showAlert('danger', errorMessage);
        
        // Shake form for UX
        this.loginForm.classList.add('animate__animated', 'animate__headShake');
        setTimeout(() => {
            this.loginForm.classList.remove('animate__animated', 'animate__headShake');
        }, 1000);
    }
    
    showAlert(type, message, autoDismiss = true) {
        const alertContainer = document.getElementById('alertContainer');
        const alertId = 'alert-' + Math.random().toString(36).substr(2, 9);
        
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
                this.removeAlert(alertId);
            }, 5000);
        }
        
        return alertId;
    }
    
    removeAlert(alertId) {
        const alertElement = document.getElementById(alertId);
        if (alertElement) {
            alertElement.classList.remove('show');
            setTimeout(() => {
                alertElement.remove();
            }, 150);
        }
    }
    
    async resendVerification(email) {
        if (!email) {
            email = this.emailInput.value;
        }
        
        if (!email) {
            this.showAlert('warning', 'Please enter your email address first.');
            return;
        }
        
        // Validate email format
        if (!this.validateEmail()) {
            this.showAlert('warning', 'Please enter a valid email address.');
            return;
        }
        
        try {
            const loadingAlertId = this.showAlert('info', 'Sending verification email...', false);
            
            const response = await fetch('http://localhost/e-terminus/api/auth/resend_verification.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ 
                    email: email,
                    csrf_token: this.csrfTokenInput.value
                })
            });
            
            const data = await response.json();
            
            this.removeAlert(loadingAlertId);
            
            if (response.ok) {
                this.showAlert('success', 'If this email is registered, a verification link has been sent.');
            } else {
                this.showAlert('info', 'If this email is registered, a verification link has been sent.');
            }
            
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('info', 'If this email is registered, a verification link has been sent.');
        }
    }
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.loginSystem = new LoginSystem();
});