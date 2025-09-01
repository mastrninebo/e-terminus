const BASE_URL = window.location.origin + '/e-terminus';
let currentUser = null;
let selectedRating = 0;
// Main initialization
$(document).ready(function() {
    initializePage();
    setupEventListeners();
    checkAuthStatus();
});
// Initialize page components
function initializePage() {
    setDefaultDate();
    animateRouteCards();
    setupNavbarScroll();
    initializeReviewsModal();
    loadPopularRoutes();
}
// Set default date to tomorrow
function setDefaultDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = $('input[type="date"]');
    if (dateInput.length) {
        dateInput.val(tomorrow.toISOString().split('T')[0]);
    }
}
// Animate route cards
function animateRouteCards() {
    const routeCards = $('.route-card');
    routeCards.each(function(index) {
        $(this).css({
            'opacity': '0',
            'transform': 'translateY(20px)',
            'transition': `all 0.5s ease ${index * 0.1}s`
        });
        
        setTimeout(() => {
            $(this).css({
                'opacity': '1',
                'transform': 'translateY(0)'
            });
        }, 100 + (index * 100));
    });
}
// Setup navbar scroll behavior
function setupNavbarScroll() {
    const navbar = $('.navbar');
    let lastScrollTop = 0;
    let scrollTimeout;
    $(window).scroll(function() {
        const scrollTop = $(this).scrollTop();
        
        // Add shadow when scrolled
        if (scrollTop > 10) {
            navbar.addClass('navbar-scrolled');
        } else {
            navbar.removeClass('navbar-scrolled');
        }
        
        // Hide/show navbar based on scroll direction
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            navbar.addClass('navbar-hidden');
        } else {
            navbar.removeClass('navbar-hidden');
        }
        
        lastScrollTop = scrollTop;
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            navbar.removeClass('navbar-hidden');
        }, 2500);
    });
}
// Setup event listeners
function setupEventListeners() {
    // Logout handlers
    $(document).on('click', '#logoutMenuItem', handleLogout);
    $(document).on('click', '#modalLogoutButton', handleLogout);
    
    // Review type toggle
    $(document).on('change', 'input[name="reviewType"]', handleReviewTypeChange);
    
    // Form submission
    $(document).on('submit', '#reviewForm', handleReviewSubmit);
    
    // Rating stars
    $(document).on('click', '.rating-star', handleStarClick);
    $(document).on('mouseenter', '.rating-star', handleStarHover);
    $(document).on('mouseleave', '.rating-stars', handleStarMouseLeave);
}
// Initialize reviews modal
function initializeReviewsModal() {
    $('#reviewsModal').on('shown.bs.modal', function() {
        if (currentUser) {
            showReviewForm();
            loadOperators();
        } else {
            showAuthAlert();
        }
    });
    
    $('#reviewsModal').on('hidden.bs.modal', function() {
        resetReviewForm();
    });
}
// Check authentication status with localStorage support
async function checkAuthStatus() {
    // Check localStorage first for immediate UI response
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
            updateUIForLoggedInUser();
        } catch (e) {
            console.error('Failed to parse stored user data:', e);
            localStorage.removeItem('currentUser');
        }
    }
    
    try {
        const token = localStorage.getItem('auth_token') || getCookie('auth_token');
        
        const response = await fetch(`${BASE_URL}/api/auth/check_session.php`, {
            credentials: 'include',
            headers: token ? {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            } : {}
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated && data.user) {
                currentUser = data.user;
                // Store user data for future use
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                updateUIForLoggedInUser();
            } else {
                // Clear invalid data
                localStorage.removeItem('currentUser');
                localStorage.removeItem('auth_token');
                updateUIForLoggedOutUser();
            }
        } else {
            // Clear invalid data on error
            localStorage.removeItem('currentUser');
            localStorage.removeItem('auth_token');
            updateUIForLoggedOutUser();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        updateUIForLoggedOutUser();
    }
}
// Update UI for logged-in users
function updateUIForLoggedInUser() {
    $('#authStatus').text(currentUser.username || 'My Account');
    $('#userWelcome').removeClass('d-none');
    $('#usernameDisplay').text(currentUser.username || 'User');
    
    // Show logged-in menu, hide not-logged-in menu
    $('#loggedInMenu').removeClass('d-none');
    $('#notLoggedInMenu').addClass('d-none');
    
    // Set dashboard URL based on user type
    let dashboardUrl = '/e-terminus/index.html'; // Default for passengers
    if (currentUser.user_type === 'admin') {
        dashboardUrl = '/e-terminus/admin/dashboard.html';
    } else if (currentUser.user_type === 'operator') {
        dashboardUrl = '/e-terminus/operator/dashboard.html';
    }
    $('#dashboardLink').attr('href', dashboardUrl);
    
    // Set profile URL
    $('#profileLink').attr('href', `/e-terminus/profile.html?user_id=${currentUser.user_id}`);
    
    // Set bookings URL
    $('#myBookingsLink').attr('href', `/e-terminus/bookings.html?user_id=${currentUser.user_id}`);
    
    // Update any other UI elements that depend on login state
    $('[data-auth="required"]').removeClass('d-none');
    $('[data-auth="hidden"]').addClass('d-none');
}
// Update UI for logged-out users
function updateUIForLoggedOutUser() {
    $('#authStatus').text('Account');
    $('#userWelcome').addClass('d-none');
    
    // Show not-logged-in menu, hide logged-in menu
    $('#notLoggedInMenu').removeClass('d-none');
    $('#loggedInMenu').addClass('d-none');
    
    currentUser = null;
    
    // Update any other UI elements that depend on login state
    $('[data-auth="required"]').addClass('d-none');
    $('[data-auth="hidden"]').removeClass('d-none');
}
// Handle logout
async function handleLogout(e) {
    if (e) e.preventDefault();
    
    try {
        // Clear localStorage first
        localStorage.removeItem('currentUser');
        localStorage.removeItem('auth_token');
        
        const response = await fetch(`${BASE_URL}/api/auth/logout.php`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(data.message || 'Logged out successfully');
        } else {
            console.error('Logout failed:', response.status);
        }
        
        // Redirect to the main landing page (same as logged-out users)
        window.location.href = BASE_URL + '/index.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Still redirect even if API call fails
        window.location.href = BASE_URL + '/index.html';
    }
}
// Show review form in modal
function showReviewForm() {
    $('#authAlert').addClass('d-none');
    $('#reviewForm').removeClass('d-none');
    $('#userName').text(currentUser.username || 'User');
    $('#userEmail').text(currentUser.email || '');
}
// Show auth alert in modal
function showAuthAlert() {
    $('#authAlert').removeClass('d-none');
    $('#reviewForm').addClass('d-none');
}
// Load operators for dropdown
async function loadOperators() {
    try {
        showLoading(true, 'Loading operators...');
        const response = await fetch(`${BASE_URL}/api/operator/list.php`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const operators = await response.json();
            populateOperatorDropdown(operators);
        } else {
            console.error('Failed to load operators:', response.status);
            showError('Failed to load bus operators. Using demo data.');
            // Load fallback operators
            loadFallbackOperators();
        }
    } catch (error) {
        console.error('Failed to load operators:', error);
        showError('Network error loading operators. Using demo data.');
        loadFallbackOperators();
    } finally {
        showLoading(false);
    }
}
// Load fallback operators
function loadFallbackOperators() {
    const fallbackOperators = [
        { operator_id: 1, company_name: 'Zambia Roadways' },
        { operator_id: 2, company_name: 'Intercity Bus Lines' },
        { operator_id: 3, company_name: 'Copperbelt Express' },
        { operator_id: 4, company_name: 'Victoria Falls Transit' }
    ];
    populateOperatorDropdown(fallbackOperators);
}
// Populate operator dropdown
function populateOperatorDropdown(operators) {
    const select = $('#operatorSelect');
    select.empty().append('<option value="">Choose a bus company...</option>');
    
    if (operators && Array.isArray(operators)) {
        operators.forEach(operator => {
            if (operator.operator_id && operator.company_name) {
                select.append(`<option value="${operator.operator_id}">${operator.company_name}</option>`);
            }
        });
    }
}
// Handle review type change
function handleReviewTypeChange() {
    if ($('#reviewOperator').is(':checked')) {
        $('#operatorSection').removeClass('d-none');
        $('#operatorSelect').prop('required', true);
    } else {
        $('#operatorSection').addClass('d-none');
        $('#operatorSelect').prop('required', false);
    }
}
// Handle star click
function handleStarClick() {
    selectedRating = $(this).data('value');
    $('#ratingValue').val(selectedRating);
    updateStarDisplay(selectedRating);
    updateRatingText(selectedRating);
}
// Handle star hover
function handleStarHover() {
    const hoverRating = $(this).data('value');
    updateStarDisplay(hoverRating);
}
// Handle star mouse leave
function handleStarMouseLeave() {
    updateStarDisplay(selectedRating);
}
// Update star display
function updateStarDisplay(rating) {
    $('.rating-star').each(function() {
        const starValue = $(this).data('value');
        if (starValue <= rating) {
            $(this).addClass('active').css('color', '#ffc107');
        } else {
            $(this).removeClass('active').css('color', '#ddd');
        }
    });
}
// Update rating text
function updateRatingText(rating) {
    const ratingTexts = [
        'Select your rating',
        'Poor - Very dissatisfied',
        'Fair - Some issues',
        'Good - Met expectations',
        'Very Good - Above average',
        'Excellent - Outstanding experience'
    ];
    $('#ratingText').text(ratingTexts[rating] || 'Select your rating');
}
// Reset review form
function resetReviewForm() {
    $('#reviewForm').trigger('reset');
    selectedRating = 0;
    updateStarDisplay(0);
    updateRatingText(0);
    $('#operatorSection').addClass('d-none');
    $('#operatorSelect').prop('required', false);
    $('input[name="reviewType"][value="platform"]').prop('checked', true);
}
// Handle review submission
async function handleReviewSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('Please log in to submit a review');
        $('#reviewsModal').modal('hide');
        return;
    }
    const formData = {
        review_type: $('input[name="reviewType"]:checked').val(),
        rating: selectedRating,
        title: $('#reviewTitle').val().trim(),
        comment: $('#reviewText').val().trim(),
        trip_reference: $('#tripReference').val().trim()
    };
    // Validation
    if (!formData.comment) {
        showError('Please provide a detailed review');
        return;
    }
    if (!formData.rating) {
        showError('Please select a rating');
        return;
    }
    if (formData.review_type === 'operator') {
        formData.operator_id = $('#operatorSelect').val();
        if (!formData.operator_id) {
            showError('Please select a bus operator');
            return;
        }
    }
    try {
        showLoading(true, 'Submitting review...');
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
            showSuccess('Thank you for your review! Your feedback has been submitted.');
            $('#reviewsModal').modal('hide');
        } else {
            showError(result.error || 'Failed to submit review. Please try again.');
        }
    } catch (error) {
        showError('Network error. Please check your connection and try again.');
    } finally {
        showLoading(false);
    }
}
// Load popular routes
function loadPopularRoutes() {
    const routes = [
        { from: 'Lusaka', to: 'Livingstone', price: 'ZMW 450', schedule: 'Multiple departures daily' },
        { from: 'Ndola', to: 'Lusaka', price: 'ZMW 250', schedule: 'Every 2 hours' },
        { from: 'Kitwe', to: 'Lusaka', price: 'ZMW 320', schedule: 'Morning & evening' },
        { from: 'Lusaka', to: 'Chipata', price: 'ZMW 450', schedule: '2 daily trips' }
    ];
    const routesContainer = $('.row.g-4');
    routesContainer.empty();
    routes.forEach((route, index) => {
        const routeCard = `
            <div class="col-md-6 col-lg-3">
                <div class="route-card h-100" style="opacity: 0; transform: translateY(20px); transition: all 0.5s ease ${index * 0.1}s">
                    <div class="card-header text-center py-3">${route.from} → ${route.to}</div>
                    <div class="card-body text-center">
                        <div class="h4 text-danger mb-3">From ${route.price}</div>
                        <p class="text-muted mb-4"><i class="fas fa-clock me-2"></i>${route.schedule}</p>
                        <button class="btn btn-sm btn-eterminus px-4">View Buses</button>
                    </div>
                </div>
            </div>
        `;
        routesContainer.append(routeCard);
    });
    // Animate the cards after they're added to the DOM
    setTimeout(() => {
        $('.route-card').each(function() {
            $(this).css({
                'opacity': '1',
                'transform': 'translateY(0)'
            });
        });
    }, 100);
}
// Show loading state
function showLoading(loading, message = '') {
    const submitButton = $('#reviewForm button[type="submit"]');
    if (submitButton.length) {
        if (loading) {
            submitButton.prop('disabled', true);
            submitButton.html(message ? 
                `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${message}` :
                `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...`);
        } else {
            submitButton.prop('disabled', false);
            submitButton.html('<i class="fas fa-paper-plane me-2"></i>Submit Review');
        }
    }
}
// Show success message (using toast notification)
function showSuccess(message) {
    // Create a toast notification
    const toast = `
        <div class="toast align-items-center text-bg-success border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-check-circle me-2"></i> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    // Append to toast container or create one
    let toastContainer = $('#toastContainer');
    if (!toastContainer.length) {
        $('body').append('<div id="toastContainer" class="toast-container position-fixed top-0 end-0 p-3"></div>');
        toastContainer = $('#toastContainer');
    }
    
    toastContainer.append(toast);
    $('.toast').toast('show');
    
    // Remove toast after it hides
    $('.toast').on('hidden.bs.toast', function () {
        $(this).remove();
    });
}
// Show error message (using toast notification)
function showError(message) {
    // Create a toast notification
    const toast = `
        <div class="toast align-items-center text-bg-danger border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-exclamation-circle me-2"></i> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    // Append to toast container or create one
    let toastContainer = $('#toastContainer');
    if (!toastContainer.length) {
        $('body').append('<div id="toastContainer" class="toast-container position-fixed top-0 end-0 p-3"></div>');
        toastContainer = $('#toastContainer');
    }
    
    toastContainer.append(toast);
    $('.toast').toast('show');
    
    // Remove toast after it hides
    $('.toast').on('hidden.bs.toast', function () {
        $(this).remove();
    });
}
// Helper function to get cookie
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}
// Reviews Carousel functionality
class ReviewsCarousel {
    constructor() {
        this.reviews = [];
        this.currentIndex = 0;
        this.container = document.querySelector('.reviews-container');
        this.indicatorsContainer = document.querySelector('.review-indicators');
        this.autoPlayInterval = null;
        this.init();
    }

    async init() {
        await this.loadReviews();
        this.renderReviews();
        this.setupEventListeners();
        this.startAutoPlay();
    }

    async loadReviews() {
        try {
            // For now, using dummy data. Replace with API call later.
            this.reviews = [
                {
                    id: 1,
                    content: "E-Terminus made my travel experience seamless. The booking process was smooth and the buses were comfortable. Highly recommended!",
                    author: "Sarah Mwape",
                    rating: 5,
                    avatar: "SM"
                },
                {
                    id: 2,
                    content: "Excellent service! The drivers are professional and the buses are always on time. I use E-Terminus for all my intercity travels.",
                    author: "James Banda",
                    rating: 5,
                    avatar: "JB"
                },
                {
                    id: 3,
                    content: "Great platform with competitive prices. The customer support team is very responsive and helpful. Will definitely use again.",
                    author: "Chisanga Phiri",
                    rating: 4,
                    avatar: "CP"
                },
                {
                    id: 4,
                    content: "The mobile app is user-friendly and the payment process is secure. I appreciate the real-time tracking feature.",
                    author: "Grace Mulenga",
                    rating: 5,
                    avatar: "GM"
                },
                {
                    id: 5,
                    content: "Reliable and affordable. I've been using E-Terminus for 2 years now and never had any issues. Keep up the good work!",
                    author: "David Kaunda",
                    rating: 4,
                    avatar: "DK"
                }
            ];

            // Later, you can replace with API call:
            // const response = await fetch(`${BASE_URL}/api/reviews/get_reviews.php`);
            // this.reviews = await response.json();
        } catch (error) {
            console.error('Failed to load reviews:', error);
        }
    }

    renderReviews() {
        // Clear container
        this.container.innerHTML = '';
        this.indicatorsContainer.innerHTML = '';

        // Create review cards
        this.reviews.forEach((review, index) => {
            // Create review card
            const reviewCard = document.createElement('div');
            reviewCard.className = `review-card ${index === 0 ? 'active' : ''}`;
            reviewCard.innerHTML = `
                <div class="review-content">
                    ${review.content}
                </div>
                <div class="review-author">
                    <div class="author-avatar">${review.avatar}</div>
                    <div class="author-info">
                        <h5>${review.author}</h5>
                        <div class="star-rating">
                            ${this.generateStars(review.rating)}
                        </div>
                    </div>
                </div>
            `;
            this.container.appendChild(reviewCard);

            // Create indicator
            const indicator = document.createElement('span');
            indicator.className = `indicator ${index === 0 ? 'active' : ''}`;
            indicator.addEventListener('click', () => this.goToSlide(index));
            this.indicatorsContainer.appendChild(indicator);
        });
    }

    generateStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += `<i class="fas fa-star${i <= rating ? '' : '-o'}"></i>`;
        }
        return stars;
    }

    setupEventListeners() {
        // Previous button
        document.getElementById('prevReview').addEventListener('click', () => {
            this.prevSlide();
            this.resetAutoPlay();
        });

        // Next button
        document.getElementById('nextReview').addEventListener('click', () => {
            this.nextSlide();
            this.resetAutoPlay();
        });

        // Pause on hover
        this.container.addEventListener('mouseenter', () => this.stopAutoPlay());
        this.container.addEventListener('mouseleave', () => this.startAutoPlay());
    }

    nextSlide() {
        this.goToSlide((this.currentIndex + 1) % this.reviews.length);
    }

    prevSlide() {
        this.goToSlide((this.currentIndex - 1 + this.reviews.length) % this.reviews.length);
    }

    goToSlide(index) {
        // Update current index
        this.currentIndex = index;

        // Update cards
        const cards = this.container.querySelectorAll('.review-card');
        cards.forEach((card, i) => {
            card.classList.remove('active', 'prev');
            if (i === index) {
                card.classList.add('active');
            } else if (i < index) {
                card.classList.add('prev');
            }
        });

        // Update indicators
        const indicators = this.indicatorsContainer.querySelectorAll('.indicator');
        indicators.forEach((indicator, i) => {
            indicator.classList.toggle('active', i === index);
        });
    }

    startAutoPlay() {
        this.stopAutoPlay();
        this.autoPlayInterval = setInterval(() => {
            this.nextSlide();
        }, 5000);
    }

    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }

    resetAutoPlay() {
        this.stopAutoPlay();
        this.startAutoPlay();
    }
}

// Initialize reviews carousel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ReviewsCarousel();
});