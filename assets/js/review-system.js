// Review System JavaScript
// Define base URL for your application
const BASE_URL = '/e-terminus';

class ReviewSystem {
    constructor() {
        this.currentUser = null;
        this.selectedRating = 0;
        this.init();
    }
    
    async init() {
        await this.checkAuthentication();
        await this.loadOperators();
        this.setupEventListeners();
    }
    
    async checkAuthentication() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                this.showAuthAlert();
                return;
            }
            
            // Updated with correct path
            const response = await fetch(`${BASE_URL}/api/auth/user-info.php`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                this.currentUser = await response.json();
                this.showReviewForm();
            } else {
                this.showAuthAlert();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showAuthAlert();
        }
    }
    
    async loadOperators() {
        try {
            // Updated with correct path
            const response = await fetch(`${BASE_URL}/api/operators/list.php`);
            if (response.ok) {
                const operators = await response.json();
                this.populateOperatorDropdown(operators);
            }
        } catch (error) {
            console.error('Failed to load operators:', error);
        }
    }
    
    populateOperatorDropdown(operators) {
        const select = document.getElementById('operatorSelect');
        select.innerHTML = '<option value="">Choose a bus company...</option>';
        
        operators.forEach(operator => {
            const option = document.createElement('option');
            option.value = operator.operator_id;
            option.textContent = operator.company_name;
            select.appendChild(option);
        });
    }
    
    setupEventListeners() {
        // Rating stars
        document.querySelectorAll('.rating-star').forEach(star => {
            star.addEventListener('click', (e) => {
                this.setRating(parseInt(e.target.dataset.value));
            });
            star.addEventListener('mouseenter', (e) => {
                this.hoverRating(parseInt(e.target.dataset.value));
            });
        });
        document.querySelector('.rating-stars').addEventListener('mouseleave', () => {
            this.resetHoverRating();
        });
        
        // Review type toggle
        document.querySelectorAll('input[name="reviewType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleOperatorSection(e.target.value === 'operator');
            });
        });
        
        // Form submission
        document.getElementById('reviewForm').addEventListener('submit', (e) => {
            this.handleSubmit(e);
        });
    }
    
    setRating(rating) {
        this.selectedRating = rating;
        document.getElementById('ratingValue').value = rating;
        
        // Update stars visually
        document.querySelectorAll('.rating-star').forEach((star, index) => {
            star.style.color = index < rating ? '#ffc107' : '#ddd';
        });
        
        // Update rating text
        const ratingTexts = [
            'Select your rating',
            'Poor',
            'Fair', 
            'Good',
            'Very Good',
            'Excellent'
        ];
        document.getElementById('ratingText').textContent = ratingTexts[rating];
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
        
        if (show) {
            section.classList.remove('d-none');
            select.setAttribute('required', 'true');
        } else {
            section.classList.add('d-none');
            select.removeAttribute('required');
        }
    }
    
    showAuthAlert() {
        document.getElementById('authAlert').classList.remove('d-none');
        document.getElementById('reviewForm').classList.add('d-none');
    }
    
    showReviewForm() {
        document.getElementById('authAlert').classList.add('d-none');
        document.getElementById('reviewForm').classList.remove('d-none');
        
        // Populate user info
        document.getElementById('userName').textContent = this.currentUser.username;
        document.getElementById('userEmail').textContent = this.currentUser.email;
    }
    
    async handleSubmit(event) {
        event.preventDefault();
        
        const formData = {
            user_id: this.currentUser.user_id,
            review_type: document.querySelector('input[name="reviewType"]:checked').value,
            rating: this.selectedRating,
            title: document.getElementById('reviewTitle').value || null, // Optional title
            comment: document.getElementById('reviewText').value,
            trip_reference: document.getElementById('tripReference').value || null
        };
        
        if (formData.review_type === 'operator') {
            formData.operator_id = document.getElementById('operatorSelect').value;
            if (!formData.operator_id) {
                alert('Please select a bus operator');
                return;
            }
        }
        
        try {
            // Updated with correct path
            const response = await fetch(`${BASE_URL}/api/reviews/submit.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showSuccess('Thank you for your review!');
                $('#reviewsModal').modal('hide');
            } else {
                this.showError(result.error || 'Failed to submit review');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }
    
    showSuccess(message) {
        alert(message);
    }
    
    showError(message) {
        alert('Error: ' + message);
    }
}

// Logout function
function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.reload();
}

// Initialize when modal is shown
$(document).ready(function() {
    $('#reviewsModal').on('shown.bs.modal', function () {
        window.reviewSystem = new ReviewSystem();
    });
});