// Review System JavaScript
// Use relative path to avoid issues in different environments
const BASE_URL = window.location.origin + '/e-terminus';

class ReviewSystem {
    constructor() {
        this.currentUser = null;
        this.selectedRating = 0;
        this.isLoading = false;
        this.init();
    }
    
    async init() {
        try {
            await this.checkAuthentication();
            await this.loadOperators();
            this.setupEventListeners();
        } catch (error) {
            console.error('Failed to initialize review system:', error);
            this.showError('Failed to initialize review system. Please refresh the page.');
        }
    }
    
    async checkAuthentication() {
        this.setLoading(true);
        
        try {
            // Check session first
            const response = await fetch(`${BASE_URL}/api/auth/check-session.php`, {
                credentials: 'include',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            const data = await response.json();
            
            if (response.ok && data.authenticated) {
                // Extract user data from the nested structure
                this.currentUser = data.user;
                this.showReviewForm();
                this.setLoading(false);
                return;
            }
            
            // Fallback to token authentication if session fails
            const token = localStorage.getItem('auth_token');
            if (token) {
                try {
                    const tokenResponse = await fetch(`${BASE_URL}/api/auth/user-info.php`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Cache-Control': 'no-cache'
                        }
                    });
                    
                    if (tokenResponse.ok) {
                        this.currentUser = await tokenResponse.json();
                        this.showReviewForm();
                        this.setLoading(false);
                        return;
                    }
                } catch (tokenError) {
                    console.warn('Token authentication failed:', tokenError);
                    // Continue to show auth alert
                }
            }
            
            // If both methods fail, show auth alert
            this.showAuthAlert();
            
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showAuthAlert();
        } finally {
            this.setLoading(false);
        }
    }
    
    async loadOperators() {
        try {
            this.setLoading(true, 'Loading operators...');
            
            const response = await fetch(`${BASE_URL}/api/operator/list.php`, {
                credentials: 'include',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            console.log('Operator response status:', response.status);
            
            if (response.ok) {
                try {
                    const operators = await response.json();
                    console.log('Operators data received:', operators);
                    this.populateOperatorDropdown(operators);
                } catch (jsonError) {
                    console.error('JSON parsing error:', jsonError);
                    // Get the response text to see what's actually returned
                    const responseText = await response.text();
                    console.error('Raw response:', responseText);
                    this.showError('Invalid data format from server');
                }
            } else {
                console.error('Failed to load operators. Status:', response.status);
                // Try to get error message from response
                try {
                    const errorData = await response.json();
                    this.showError(errorData.error || 'Failed to load bus operators');
                } catch {
                    this.showError('Failed to load bus operators. Please try again later.');
                }
            }
        } catch (error) {
            console.error('Network error loading operators:', error);
            this.showError('Network error loading operators. Please check your connection.');
        } finally {
            this.setLoading(false);
        }
    }
    
    populateOperatorDropdown(operators) {
        const select = document.getElementById('operatorSelect');
        if (!select) {
            console.error('Operator select element not found');
            return;
        }
        
        select.innerHTML = '<option value="">Choose a bus company...</option>';
        
        console.log('Populating operators:', operators);
        
        if (!operators || !Array.isArray(operators)) {
            console.error('Invalid operators data - expected array, got:', operators);
            this.showError('Invalid operators data received');
            return;
        }
        
        if (operators.length === 0) {
            console.warn('No operators found in response');
            // Add a disabled option indicating no operators
            const option = document.createElement('option');
            option.disabled = true;
            option.textContent = 'No operators available';
            select.appendChild(option);
            return;
        }
        
        operators.forEach(operator => {
            // Validate each operator object
            if (!operator.operator_id || !operator.company_name) {
                console.warn('Invalid operator object:', operator);
                return; // Skip invalid entries
            }
            
            const option = document.createElement('option');
            option.value = operator.operator_id;
            option.textContent = operator.company_name;
            select.appendChild(option);
        });
        
        console.log('Operators dropdown populated successfully');
    }
    
    setupEventListeners() {
        // Rating stars
        const stars = document.querySelectorAll('.rating-star');
        if (stars.length === 0) {
            console.error('Rating stars not found');
            return;
        }
        
        stars.forEach(star => {
            star.addEventListener('click', (e) => {
                this.setRating(parseInt(e.target.dataset.value));
            });
            star.addEventListener('mouseenter', (e) => {
                this.hoverRating(parseInt(e.target.dataset.value));
            });
        });
        
        const starsContainer = document.querySelector('.rating-stars');
        if (starsContainer) {
            starsContainer.addEventListener('mouseleave', () => {
                this.resetHoverRating();
            });
        }
        
        // Review type toggle
        const reviewTypeRadios = document.querySelectorAll('input[name="reviewType"]');
        if (reviewTypeRadios.length === 0) {
            console.error('Review type radios not found');
            return;
        }
        
        reviewTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleOperatorSection(e.target.value === 'operator');
            });
        });
        
        // Form submission
        const reviewForm = document.getElementById('reviewForm');
        if (!reviewForm) {
            console.error('Review form not found');
            return;
        }
        
        reviewForm.addEventListener('submit', (e) => {
            this.handleSubmit(e);
        });
        
        // Logout button
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }
    
    setRating(rating) {
        this.selectedRating = rating;
        const ratingValueInput = document.getElementById('ratingValue');
        if (ratingValueInput) {
            ratingValueInput.value = rating;
        }
        
        // Update stars visually
        document.querySelectorAll('.rating-star').forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
                star.style.color = '#ffc107';
            } else {
                star.classList.remove('active');
                star.style.color = '#ddd';
            }
        });
        
        // Update rating text
        const ratingTexts = {
            1: 'Poor - Very dissatisfied',
            2: 'Fair - Some issues', 
            3: 'Good - Met expectations',
            4: 'Very Good - Above average',
            5: 'Excellent - Outstanding experience'
        };
        
        const ratingTextElement = document.getElementById('ratingText');
        if (ratingTextElement) {
            ratingTextElement.textContent = ratingTexts[rating] || 'Select your rating';
        }
    }
    
    hoverRating(rating) {
        document.querySelectorAll('.rating-star').forEach((star, index) => {
            star.style.color = index < rating ? '#ffc107' : '#ddd';
        });
    }
    
    resetHoverRating() {
        document.querySelectorAll('.rating-star').forEach((star, index) => {
            star.style.color = index < this.selectedRating ? '#ffc107' : '#ddd';
        });
    }
    
    toggleOperatorSection(show) {
        const section = document.getElementById('operatorSection');
        const select = document.getElementById('operatorSelect');
        
        if (section && select) {
            if (show) {
                section.classList.remove('d-none');
                select.setAttribute('required', 'true');
            } else {
                section.classList.add('d-none');
                select.removeAttribute('required');
            }
        }
    }
    
    showAuthAlert() {
        const authAlert = document.getElementById('authAlert');
        const reviewForm = document.getElementById('reviewForm');
        
        if (authAlert) authAlert.classList.remove('d-none');
        if (reviewForm) reviewForm.classList.add('d-none');
    }
    
    showReviewForm() {
        const authAlert = document.getElementById('authAlert');
        const reviewForm = document.getElementById('reviewForm');
        
        if (authAlert) authAlert.classList.add('d-none');
        if (reviewForm) reviewForm.classList.remove('d-none');
        
        // Populate user info - handle the nested structure
        if (this.currentUser) {
            // Check if user data is nested in a 'user' property
            const userData = this.currentUser.user || this.currentUser;
            const userNameElement = document.getElementById('userName');
            const userEmailElement = document.getElementById('userEmail');
            
            if (userNameElement) {
                userNameElement.textContent = userData.username || userData.name || 'User';
            }
            
            if (userEmailElement) {
                userEmailElement.textContent = userData.email || '';
            }
        }
    }
    
    async handleSubmit(event) {
        event.preventDefault();
        
        if (!this.currentUser) {
            this.showError('Please log in to submit a review');
            return;
        }
        
        // Extract the actual user data (could be nested or direct)
        const userData = this.currentUser.user || this.currentUser;
        const userId = userData.user_id || userData.id;
        
        if (!userId) {
            this.showError('User information incomplete. Please log in again.');
            return;
        }
        
        const formData = {
            review_type: document.querySelector('input[name="reviewType"]:checked').value,
            rating: this.selectedRating,
            title: document.getElementById('reviewTitle').value.trim() || null,
            comment: document.getElementById('reviewText').value.trim(),
            trip_reference: document.getElementById('tripReference').value.trim() || null
        };
        
        if (formData.review_type === 'operator') {
            formData.operator_id = document.getElementById('operatorSelect').value;
            if (!formData.operator_id) {
                this.showError('Please select a bus operator');
                return;
            }
        }
        
        // Basic validation
        if (!formData.comment) {
            this.showError('Please provide a detailed review');
            return;
        }
        
        if (this.selectedRating === 0) {
            this.showError('Please select a rating');
            return;
        }
        
        this.setLoading(true, 'Submitting review...');
        
        try {
            const response = await fetch(`${BASE_URL}/api/reviews/submit.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showSuccess('Thank you for your review! Your feedback has been submitted.');
                // Close modal and reset form
                $('#reviewsModal').modal('hide');
                document.getElementById('reviewForm').reset();
                this.setRating(0);
            } else {
                this.showError(result.error || 'Failed to submit review. Please try again.');
            }
        } catch (error) {
            console.error('Submission error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setLoading(false);
        }
    }
    
    setLoading(loading, message = '') {
        this.isLoading = loading;
        const submitButton = document.querySelector('#reviewForm button[type="submit"]');
        
        if (submitButton) {
            if (loading) {
                submitButton.disabled = true;
                submitButton.innerHTML = message ? 
                    `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${message}` :
                    `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...`;
            } else {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Submit Review';
            }
        }
    }
    
    showSuccess(message) {
        // Use a toast notification or alert
        alert(message);
    }
    
    showError(message) {
        alert('Error: ' + message);
    }
    
    logout() {
        // Clear both session and token
        localStorage.removeItem('auth_token');
        
        // Call logout endpoint
        fetch(`${BASE_URL}/api/auth/logout.php`, {
            method: 'POST',
            credentials: 'include'
        }).then(() => {
            window.location.reload();
        }).catch(error => {
            console.error('Logout error:', error);
            window.location.reload(); // Still reload even if logout API fails
        });
    }
}

// Initialize when modal is shown
$(document).ready(function() {
    $('#reviewsModal').on('shown.bs.modal', function () {
        // Destroy previous instance if exists
        if (window.reviewSystem) {
            window.reviewSystem = null;
        }
        window.reviewSystem = new ReviewSystem();
    });
    
    // Reset form when modal is hidden
    $('#reviewsModal').on('hidden.bs.modal', function () {
        const form = document.getElementById('reviewForm');
        if (form) {
            form.reset();
        }
        if (window.reviewSystem) {
            window.reviewSystem.setRating(0);
        }
    });
});