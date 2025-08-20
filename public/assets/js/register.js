class RegistrationSystem {
    constructor() {
        this.registerForm = document.getElementById('registerForm');
        this.apiUrl = 'http://localhost/e-terminus/api/auth/register.php';
        this.passwordInput = document.getElementById('password');
        this.progressBar = document.querySelector('.progress-bar');
        this.csrfTokenInput = document.getElementById('csrfToken');
        
        this.initEventListeners();
        this.setupPasswordStrength();
        this.fetchCSRFToken();
    }

    initEventListeners() {
        // Password visibility toggle
        document.querySelectorAll('.toggle-password').forEach(button => {
            button.addEventListener('click', () => this.togglePasswordVisibility(button));
        });

        // Phone number formatting
        document.getElementById('phone')?.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9);
        });

        // Form submission
        this.registerForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async fetchCSRFToken() {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.csrf_token) {
                    this.csrfTokenInput.value = data.csrf_token;
                }
            }
        } catch (error) {
            console.error('Failed to fetch CSRF token:', error);
        }
    }

    setupPasswordStrength() {
        this.passwordInput.addEventListener('input', () => {
            const password = this.passwordInput.value;
            const strength = this.calculatePasswordStrength(password);
            this.updateStrengthIndicator(strength);
            this.updatePasswordRequirements(password);
        });
    }

    calculatePasswordStrength(password) {
        let strength = 0;
        
        // Length check
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 25;
        
        // Complexity checks
        if (/[A-Z]/.test(password)) strength += 15;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^A-Za-z0-9]/.test(password)) strength += 20;
        
        return Math.min(strength, 100);
    }

    updateStrengthIndicator(strength) {
        this.progressBar.style.width = `${strength}%`;
        
        // Change color based on strength
        if (strength < 40) {
            this.progressBar.className = 'progress-bar bg-danger';
        } else if (strength < 70) {
            this.progressBar.className = 'progress-bar bg-warning';
        } else {
            this.progressBar.className = 'progress-bar bg-success';
        }
    }

    updatePasswordRequirements(password) {
        const lengthReq = document.getElementById('length-req');
        const uppercaseReq = document.getElementById('uppercase-req');
        const numberReq = document.getElementById('number-req');
        
        // Update length requirement
        if (password.length >= 8) {
            lengthReq.querySelector('i').className = 'fas fa-check-circle valid';
            lengthReq.querySelector('span').className = 'valid';
        } else {
            lengthReq.querySelector('i').className = 'fas fa-circle invalid';
            lengthReq.querySelector('span').className = 'invalid';
        }
        
        // Update uppercase requirement
        if (/[A-Z]/.test(password)) {
            uppercaseReq.querySelector('i').className = 'fas fa-check-circle valid';
            uppercaseReq.querySelector('span').className = 'valid';
        } else {
            uppercaseReq.querySelector('i').className = 'fas fa-circle invalid';
            uppercaseReq.querySelector('span').className = 'invalid';
        }
        
        // Update number requirement
        if (/[0-9]/.test(password)) {
            numberReq.querySelector('i').className = 'fas fa-check-circle valid';
            numberReq.querySelector('span').className = 'valid';
        } else {
            numberReq.querySelector('i').className = 'fas fa-circle invalid';
            numberReq.querySelector('span').className = 'invalid';
        }
    }

    togglePasswordVisibility(button) {
        const input = button.previousElementSibling;
        const icon = button.querySelector('i');
        input.type = input.type === 'password' ? 'text' : 'password';
        icon.classList.toggle('fa-eye-slash');
        icon.classList.toggle('fa-eye');
    }

    async handleSubmit(event) {
        event.preventDefault();
        console.log('[DEBUG] Form submission started');

        // Disable submit button during processing
        const submitBtn = this.registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Processing...';

        try {
            const formData = this.getFormData();
            console.log('[DEBUG] Form data:', formData);

            // Client-side validation
            if (!this.validateForm(formData)) {
                console.warn('[DEBUG] Client-side validation failed');
                return;
            }

            const response = await this.sendRegistrationRequest(formData);
            console.log('[DEBUG] API Response:', response);

            if (response.success) {
                this.showSuccessMessage(response.message);
                // Update CSRF token after successful registration
                if (response.csrf_token) {
                    this.csrfTokenInput.value = response.csrf_token;
                }
                
                // For testing purposes, show verification link
                if (response.verification_token) {
                    this.showAlert('info', `For testing: <a href="verify.php?token=${response.verification_token}">Click to verify</a>`, false);
                }
                
                setTimeout(() => {
                    window.location.href = 'http://localhost/e-terminus/public/login.html';
                }, 3000);
            } else {
                this.handleRegistrationError(response);
            }
        } catch (error) {
            console.error('[DEBUG] Registration error:', error);
            this.showAlert('danger', 'Network error. Please try again later.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-user-check me-2"></i>Register';
        }
    }

    getFormData() {
        return {
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: '260' + document.getElementById('phone').value.trim(),
            password: document.getElementById('password').value,
            csrfToken: this.csrfTokenInput.value
        };
    }

    validateForm(formData) {
        const errors = {};
        const password = formData.password;

        if (!formData.username) errors.username = 'Username is required';
        if (!formData.email.includes('@')) errors.email = 'Invalid email format';
        if (formData.phone.length !== 12) errors.phone = 'Phone must be 9 digits after 260';
        
        // Password validation
        if (password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        } else if (!/[A-Z]/.test(password)) {
            errors.password = 'Password must contain at least one uppercase letter';
        } else if (!/[0-9]/.test(password)) {
            errors.password = 'Password must contain at least one number';
        }

        if (Object.keys(errors).length > 0) {
            this.displayFieldErrors(errors);
            return false;
        }
        return true;
    }

    displayFieldErrors(errors) {
        // Clear previous errors
        document.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
        document.querySelectorAll('.invalid-feedback').forEach(el => {
            el.textContent = '';
        });

        // Show new errors
        for (const [field, message] of Object.entries(errors)) {
            const input = document.getElementById(field);
            if (input) {
                input.classList.add('is-invalid');
                const feedback = input.nextElementSibling;
                if (feedback && feedback.classList.contains('invalid-feedback')) {
                    feedback.textContent = message;
                }
            }
            this.showAlert('danger', message);
        }
    }

    async sendRegistrationRequest(formData) {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.errors) {
                this.displayFieldErrors(data.errors);
            }
            throw new Error(data.error || 'Registration failed');
        }

        return data;
    }

    showAlert(type, message, autoDismiss = true) {
        const alertContainer = document.getElementById('alertContainer') || document.body;
        const alertId = 'alert-' + Date.now();

        const alertDiv = document.createElement('div');
        alertDiv.id = alertId;
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'danger' ? 'fa-exclamation-triangle' : 'fa-info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        alertContainer.prepend(alertDiv);

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

    showSuccessMessage(message) {
        this.showAlert('success', message, false);
        this.registerForm.reset();
        this.progressBar.style.width = '0%';
        this.progressBar.className = 'progress-bar';
    }

    handleRegistrationError(response) {
        if (response.error === 'User already exists') {
            this.showAlert('danger', 'An account with this email/username already exists');
        } else if (response.error === 'CSRF token validation failed') {
            this.showAlert('danger', 'Security token expired. Please refresh the page and try again.');
            this.fetchCSRFToken();
        } else {
            this.showAlert('danger', response.error || 'Registration failed. Please try again.');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('registerForm')) {
        new RegistrationSystem();
    } else {
        console.warn('Register form not found');
    }
});