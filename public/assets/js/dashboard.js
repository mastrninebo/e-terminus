const BASE_URL = window.location.origin + '/e-terminus';
let currentUser = null;

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
    loadDashboardData();
    handleTabSwitching();
});

// Check if user is authenticated
async function checkAuthStatus() {
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
                updateUIForLoggedInUser();
                loadDashboardData();
            } else {
                // Not authenticated, redirect to login
                window.location.href = `${BASE_URL}/public/login.html`;
            }
        } else {
            // Authentication failed, redirect to login
            window.location.href = `${BASE_URL}/public/login.html`;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = `${BASE_URL}/public/login.html`;
    }
}

// Helper function to get cookies
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Update UI for logged-in user
function updateUIForLoggedInUser() {
    if (!currentUser) return;
    
    // Update user info in sidebar
    document.querySelector('.sidebar h5').textContent = currentUser.username || 'User';
    document.querySelector('.sidebar small').textContent = `Member since ${new Date(currentUser.created_at || '2024').getFullYear()}`;
    
    // Update user avatar
    const avatarImg = document.querySelector('.user-avatar');
    if (avatarImg) {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.username)}&background=random`;
        avatarImg.alt = currentUser.username;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Mobile menu toggle
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', function() {
            sidebar.classList.toggle('show');
        });
        
        // Close sidebar when clicking on a nav link in mobile view
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth < 992) {
                    sidebar.classList.remove('show');
                }
            });
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(event) {
            if (window.innerWidth < 992 && 
                !sidebar.contains(event.target) && 
                event.target !== mobileToggle && 
                !mobileToggle.contains(event.target)) {
                sidebar.classList.remove('show');
            }
        });
    }
    
    // New booking button
    const newBookingBtn = document.querySelector('.btn-gradient-primary');
    if (newBookingBtn) {
        newBookingBtn.addEventListener('click', function() {
            window.location.href = `${BASE_URL}/index.html`;
        });
    }
    
    // Back to home button
    const backHomeBtn = document.querySelector('.btn-outline-secondary');
    if (backHomeBtn && backHomeBtn.textContent.includes('Back to Home')) {
        // The button already has an href attribute, so no need to add a click listener
    }
    
    // View ticket button
    document.querySelectorAll('.btn-outline-primary').forEach(btn => {
        if (btn.textContent.includes('View Ticket')) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const bookingId = this.getAttribute('data-id');
                if (bookingId) {
                    viewTicketDetails(bookingId);
                } else {
                    showNotification('Ticket details would be shown here', 'info');
                }
            });
        }
    });
    
    // Cancel booking button
    document.querySelectorAll('.btn-outline-danger').forEach(btn => {
        if (btn.textContent.includes('Cancel')) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const bookingId = this.getAttribute('data-id');
                if (bookingId) {
                    if (confirm('Are you sure you want to cancel this booking?')) {
                        cancelBooking(bookingId);
                    }
                } else {
                    showNotification('Booking cancelled successfully', 'success');
                }
            });
        }
    });
    
    // Rate trip button
    document.querySelectorAll('.btn-outline-primary').forEach(btn => {
        if (btn.textContent.includes('Rate Trip')) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const bookingId = this.getAttribute('data-id');
                if (bookingId) {
                    window.location.href = `${BASE_URL}/public/review.html?booking_id=${bookingId}`;
                } else {
                    window.location.href = `${BASE_URL}/index.html#reviewsModal`;
                }
            });
        }
    });
    
    // Quick action buttons
    document.querySelectorAll('.quick-action-card .btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const text = this.textContent.trim();
            
            if (text.includes('Find a Bus')) {
                window.location.href = `${BASE_URL}/index.html`;
            } else if (text.includes('Booking History')) {
                // Switch to bookings tab
                const bookingsTab = document.querySelector('[href="#bookings"]');
                if (bookingsTab) {
                    bookingsTab.click();
                }
            } else if (text.includes('Leave a Review')) {
                window.location.href = `${BASE_URL}/public/reviews.html`;
            }
        });
    });
    
    // Handle tab switching to load data when needed
    document.querySelectorAll('a[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(e) {
            const target = e.target.getAttribute('href');
            
            if (target === '#trips') {
                loadTripsData();
            } else if (target === '#bookings') {
                loadBookingsData();
            } else if (target === '#reviews') {
                loadReviewsData();
            } else if (target === '#settings') {
                loadUserSettings();
                setupSettingsForms();
            }
        });
    });
}

// Handle tab switching
function handleTabSwitching() {
    const tabPanes = document.querySelectorAll('.tab-pane');
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const target = this.getAttribute('href');
            tabPanes.forEach(pane => pane.classList.remove('show', 'active'));
            document.querySelector(target).classList.add('show', 'active');
        });
    });
}

// Load dashboard data
async function loadDashboardData() {
    if (!currentUser) return;
    
    try {
        // Show loading state
        showLoadingState();
        
        // Load user statistics
        await loadUserStats();
        
        // Load upcoming trips
        await loadUpcomingTrips();
        
        // Load recent activity
        await loadRecentActivity();
        
        // Load bookings data
        await loadBookingsData();
        
        // Hide loading state
        hideLoadingState();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'danger');
        hideLoadingState();
    }
}

// Show loading state
function showLoadingState() {
    // Add loading indicators to stat cards
    document.querySelectorAll('#dashboard .stat-card h2').forEach(el => {
        el.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div>';
    });
    
    // Add loading indicator to next trip section
    const nextTripElement = document.querySelector('#dashboard .card.mb-4 .card-body .row');
    if (nextTripElement) {
        nextTripElement.innerHTML = `
            <div class="col-12 text-center py-4">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    }
    
    // Add loading indicator to recent activity
    const activityContainer = document.querySelector('#dashboard .list-group');
    if (activityContainer) {
        activityContainer.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    }
}

// Hide loading state
function hideLoadingState() {
    // Loading indicators will be replaced by actual data
}

// Load user statistics
async function loadUserStats() {
    try {
        const response = await fetch(`${BASE_URL}/api/user/get_stats.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            
            // Update upcoming trips count
            const upcomingTripsElement = document.querySelector('#dashboard .stat-card:first-child h2');
            if (upcomingTripsElement && stats.upcoming_trips !== undefined) {
                upcomingTripsElement.textContent = stats.upcoming_trips;
            }
            
            // Update completed trips count
            const completedTripsElement = document.querySelector('#dashboard .stat-card:nth-child(2) h2');
            if (completedTripsElement && stats.completed_trips !== undefined) {
                completedTripsElement.textContent = stats.completed_trips;
            }
            
            // Update pending reviews count
            const pendingReviewsElement = document.querySelector('#dashboard .stat-card:last-child h2');
            if (pendingReviewsElement && stats.pending_reviews !== undefined) {
                pendingReviewsElement.textContent = stats.pending_reviews;
            }
        } else {
            // If API fails, use default values
            document.querySelector('#dashboard .stat-card:first-child h2').textContent = '0';
            document.querySelector('#dashboard .stat-card:nth-child(2) h2').textContent = '0';
            document.querySelector('#dashboard .stat-card:last-child h2').textContent = '0';
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
        // If there's an error, use default values
        document.querySelector('#dashboard .stat-card:first-child h2').textContent = '0';
        document.querySelector('#dashboard .stat-card:nth-child(2) h2').textContent = '0';
        document.querySelector('#dashboard .stat-card:last-child h2').textContent = '0';
    }
}

// Load upcoming trips
async function loadUpcomingTrips() {
    try {
        const response = await fetch(`${BASE_URL}/api/user/get_upcoming_trips.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (response.ok) {
            const trips = await response.json();
            
            const nextTripElement = document.querySelector('#dashboard .card.mb-4 .card-body .row');
            if (nextTripElement) {
                if (trips.length > 0) {
                    const nextTrip = trips[0];
                    
                    nextTripElement.innerHTML = `
                        <div class="col-md-6">
                            <h4>${nextTrip.from_location} → ${nextTrip.to_location}</h4>
                            <p class="mb-1"><i class="fas fa-calendar-alt me-2"></i>${formatDate(nextTrip.departure_date)}</p>
                            <p class="mb-1"><i class="fas fa-clock me-2"></i>${nextTrip.departure_time}</p>
                            <p class="mb-1"><i class="fas fa-bus me-2"></i>${nextTrip.operator_name}</p>
                        </div>
                        <div class="col-md-6">
                            <div class="d-flex justify-content-between flex-wrap">
                                <div class="mb-2 mb-md-0">
                                    <p class="mb-1"><i class="fas fa-ticket-alt me-2"></i>Ticket #${nextTrip.booking_id}</p>
                                    ${nextTrip.seat_number ? `<p class="mb-1"><i class="fas fa-chair me-2"></i>Seat ${nextTrip.seat_number}</p>` : ''}
                                </div>
                                <div class="text-md-end">
                                    <button class="btn btn-outline-primary view-ticket" data-id="${nextTrip.booking_id}">
                                        <i class="fas fa-ticket-alt me-1"></i> View Ticket
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    // Add event listener to view ticket button
                    const viewTicketBtn = nextTripElement.querySelector('.view-ticket');
                    if (viewTicketBtn) {
                        viewTicketBtn.addEventListener('click', function() {
                            const bookingId = this.getAttribute('data-id');
                            viewTicketDetails(bookingId);
                        });
                    }
                } else {
                    nextTripElement.innerHTML = `
                        <div class="col-12 text-center py-4">
                            <p class="text-muted">No upcoming trips found</p>
                            <button class="btn btn-gradient-primary">
                                <i class="fas fa-plus me-1"></i> Book a Trip
                            </button>
                        </div>
                    `;
                }
            }
        } else {
            // Handle API error
            const nextTripElement = document.querySelector('#dashboard .card.mb-4 .card-body .row');
            if (nextTripElement) {
                nextTripElement.innerHTML = `
                    <div class="col-12 text-center py-4">
                        <p class="text-muted">Unable to load trip data</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading upcoming trips:', error);
        // Handle error
        const nextTripElement = document.querySelector('#dashboard .card.mb-4 .card-body .row');
        if (nextTripElement) {
            nextTripElement.innerHTML = `
                <div class="col-12 text-center py-4">
                    <p class="text-muted">Unable to load trip data</p>
                </div>
            `;
        }
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const response = await fetch(`${BASE_URL}/api/user/get_recent_activity.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (response.ok) {
            const activities = await response.json();
            const activityContainer = document.querySelector('#dashboard .list-group');
            
            if (activityContainer) {
                if (activities.length > 0) {
                    let activityHtml = '';
                    activities.forEach(activity => {
                        const icon = getActivityIcon(activity.type);
                        const timeAgo = getTimeAgo(activity.created_at);
                        
                        activityHtml += `
                            <a href="#" class="list-group-item list-group-item-action">
                                <div class="d-flex justify-content-between">
                                    <div>
                                        <h6 class="mb-1">${activity.title}</h6>
                                        <small class="text-muted">${activity.description}</small>
                                    </div>
                                    <small>${timeAgo}</small>
                                </div>
                            </a>
                        `;
                    });
                    
                    activityContainer.innerHTML = activityHtml;
                } else {
                    activityContainer.innerHTML = `
                        <div class="text-center py-4">
                            <p class="text-muted">No recent activity</p>
                        </div>
                    `;
                }
            }
        } else {
            // Handle API error
            const activityContainer = document.querySelector('#dashboard .list-group');
            if (activityContainer) {
                activityContainer.innerHTML = `
                    <div class="text-center py-4">
                        <p class="text-muted">Unable to load activity data</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading recent activity:', error);
        // Handle error
        const activityContainer = document.querySelector('#dashboard .list-group');
        if (activityContainer) {
            activityContainer.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-muted">Unable to load activity data</p>
                </div>
            `;
        }
    }
}

// Load bookings data
async function loadBookingsData() {
    try {
        const response = await fetch(`${BASE_URL}/api/user/get_bookings.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (response.ok) {
            const bookings = await response.json();
            const bookingsTable = document.querySelector('#bookings table tbody');
            
            if (bookingsTable) {
                if (bookings.length > 0) {
                    let bookingsHtml = '';
                    bookings.forEach(booking => {
                        const statusClass = getStatusClass(booking.status);
                        const statusText = formatStatus(booking.status);
                        
                        bookingsHtml += `
                            <tr>
                                <td>#${booking.booking_id}</td>
                                <td>${booking.from_location} → ${booking.to_location}</td>
                                <td>${formatDate(booking.booking_date)}</td>
                                <td><span class="badge ${statusClass}">${statusText}</span></td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary view-booking" data-id="${booking.booking_id}">
                                        <i class="fas fa-eye"></i> View
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                    
                    bookingsTable.innerHTML = bookingsHtml;
                    
                    // Add event listeners to view buttons
                    document.querySelectorAll('.view-booking').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const bookingId = this.getAttribute('data-id');
                            viewBookingDetails(bookingId);
                        });
                    });
                } else {
                    bookingsTable.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center py-3 text-muted">No bookings found</td>
                        </tr>
                    `;
                }
            }
        } else {
            // Handle API error
            const bookingsTable = document.querySelector('#bookings table tbody');
            if (bookingsTable) {
                bookingsTable.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-3 text-muted">Unable to load bookings</td>
                    </tr>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading bookings data:', error);
        // Handle error
        const bookingsTable = document.querySelector('#bookings table tbody');
        if (bookingsTable) {
            bookingsTable.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-3 text-muted">Unable to load bookings</td>
                </tr>
            `;
        }
    }
}

// Load trips data for My Trips tab
async function loadTripsData() {
    try {
        // Load upcoming trips
        const upcomingResponse = await fetch(`${BASE_URL}/api/user/get_upcoming_trips.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (upcomingResponse.ok) {
            const upcomingTrips = await upcomingResponse.json();
            const upcomingContainer = document.querySelector('#upcoming .list-group');
            
            if (upcomingContainer) {
                if (upcomingTrips.length > 0) {
                    let upcomingHtml = '';
                    upcomingTrips.forEach(trip => {
                        const daysUntil = Math.ceil((new Date(trip.departure_date) - new Date()) / (1000 * 60 * 60 * 24));
                        
                        upcomingHtml += `
                            <a href="#" class="list-group-item list-group-item-action">
                                <div class="d-flex justify-content-between align-items-center flex-wrap">
                                    <div class="mb-2 mb-md-0">
                                        <h5 class="mb-1">${trip.from_location} → ${trip.to_location}</h5>
                                        <small class="text-muted">${formatDate(trip.departure_date)} • Seat ${trip.seat_number || 'N/A'}</small>
                                    </div>
                                    <div>
                                        <span class="badge bg-primary me-2">Departs in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}</span>
                                        <button class="btn btn-sm btn-outline-danger cancel-trip" data-id="${trip.booking_id}">
                                            <i class="fas fa-times"></i> Cancel
                                        </button>
                                    </div>
                                </div>
                            </a>
                        `;
                    });
                    
                    upcomingContainer.innerHTML = upcomingHtml;
                    
                    // Add event listeners to cancel buttons
                    document.querySelectorAll('.cancel-trip').forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            const bookingId = this.getAttribute('data-id');
                            if (confirm('Are you sure you want to cancel this booking?')) {
                                cancelBooking(bookingId);
                            }
                        });
                    });
                } else {
                    upcomingContainer.innerHTML = '<div class="text-center py-3 text-muted">No upcoming trips</div>';
                }
            }
        }
        
        // Load completed trips
        const completedResponse = await fetch(`${BASE_URL}/api/user/get_completed_trips.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (completedResponse.ok) {
            const completedTrips = await completedResponse.json();
            const completedContainer = document.querySelector('#completed .list-group');
            
            if (completedContainer) {
                if (completedTrips.length > 0) {
                    let completedHtml = '';
                    completedTrips.forEach(trip => {
                        completedHtml += `
                            <a href="#" class="list-group-item list-group-item-action">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 class="mb-1">${trip.from_location} → ${trip.to_location}</h5>
                                        <small class="text-muted">${formatDate(trip.departure_date)} • Seat ${trip.seat_number || 'N/A'}</small>
                                    </div>
                                    <button class="btn btn-sm btn-outline-primary rate-trip" data-id="${trip.booking_id}">
                                        <i class="fas fa-star"></i> Rate Trip
                                    </button>
                                </div>
                            </a>
                        `;
                    });
                    
                    completedContainer.innerHTML = completedHtml;
                    
                    // Add event listeners to rate buttons
                    document.querySelectorAll('.rate-trip').forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            const bookingId = this.getAttribute('data-id');
                            window.location.href = `${BASE_URL}/public/review.html?booking_id=${bookingId}`;
                        });
                    });
                } else {
                    completedContainer.innerHTML = '<div class="text-center py-3 text-muted">No completed trips</div>';
                }
            }
        }
    } catch (error) {
        console.error('Error loading trips data:', error);
        showNotification('Error loading trips data', 'danger');
    }
}

// Load reviews data
async function loadReviewsData() {
    try {
        // Load user reviews
        const reviewsResponse = await fetch(`${BASE_URL}/api/user/get_reviews.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (reviewsResponse.ok) {
            const reviews = await reviewsResponse.json();
            const reviewsContainer = document.querySelector('#my-reviews .list-group');
            
            if (reviewsContainer) {
                if (reviews.length > 0) {
                    let reviewsHtml = '';
                    reviews.forEach(review => {
                        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                        
                        reviewsHtml += `
                            <div class="list-group-item">
                                <div class="d-flex justify-content-between">
                                    <div>
                                        <h5 class="mb-1">${review.operator_name} - ${review.from_location} to ${review.to_location}</h5>
                                        <div class="text-warning mb-2">${stars}</div>
                                        <p class="mb-1">${review.comment}</p>
                                        <small class="text-muted">${formatDate(review.review_date)}</small>
                                    </div>
                                    <div>
                                        <button class="btn btn-sm btn-outline-secondary edit-review" data-id="${review.review_id}">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    
                    reviewsContainer.innerHTML = reviewsHtml;
                    
                    // Add event listeners to edit buttons
                    document.querySelectorAll('.edit-review').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const reviewId = this.getAttribute('data-id');
                            showNotification(`Editing review #${reviewId}`, 'info');
                        });
                    });
                } else {
                    reviewsContainer.innerHTML = '<div class="text-center py-3 text-muted">No reviews yet</div>';
                }
            }
        }
        
        // Load pending reviews
        const pendingResponse = await fetch(`${BASE_URL}/api/user/get_pending_reviews.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (pendingResponse.ok) {
            const pendingReviews = await pendingResponse.json();
            const pendingContainer = document.querySelector('#pending-reviews .list-group');
            
            if (pendingContainer) {
                if (pendingReviews.length > 0) {
                    let pendingHtml = '';
                    pendingReviews.forEach(trip => {
                        pendingHtml += `
                            <div class="list-group-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 class="mb-1">${trip.from_location} to ${trip.to_location}</h5>
                                        <p class="mb-1">${trip.operator_name} - ${formatDate(trip.departure_date)}</p>
                                    </div>
                                    <button class="btn btn-sm btn-primary rate-trip" data-id="${trip.booking_id}">
                                        <i class="fas fa-star"></i> Rate Now
                                    </button>
                                </div>
                            </div>
                        `;
                    });
                    
                    pendingContainer.innerHTML = pendingHtml;
                    
                    // Add event listeners to rate buttons
                    document.querySelectorAll('.rate-trip').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const bookingId = this.getAttribute('data-id');
                            window.location.href = `${BASE_URL}/public/review.html?booking_id=${bookingId}`;
                        });
                    });
                } else {
                    pendingContainer.innerHTML = '<div class="text-center py-3 text-muted">No pending reviews</div>';
                }
            }
        }
    } catch (error) {
        console.error('Error loading reviews data:', error);
        showNotification('Error loading reviews data', 'danger');
    }
}

// Load user settings
async function loadUserSettings() {
    try {
        const response = await fetch(`${BASE_URL}/api/user/get_settings.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (response.ok) {
            const settings = await response.json();
            
            // Update profile form
            document.getElementById('firstName').value = settings.first_name || '';
            document.getElementById('lastName').value = settings.last_name || '';
            document.getElementById('username').value = settings.username || '';
            document.getElementById('email').value = settings.email || '';
            document.getElementById('phone').value = settings.phone || '';
            document.getElementById('address').value = settings.address || '';
            
            // Update notification preferences
            document.getElementById('emailNotifications').checked = settings.email_notifications !== false;
            document.getElementById('smsNotifications').checked = settings.sms_notifications === true;
            document.getElementById('promotionalNotifications').checked = settings.promotional_notifications !== false;
            document.getElementById('tripReminders').checked = settings.trip_reminders !== false;
        }
    } catch (error) {
        console.error('Error loading user settings:', error);
        showNotification('Error loading user settings', 'danger');
    }
}

// Setup settings form handlers
function setupSettingsForms() {
    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                first_name: document.getElementById('firstName').value,
                last_name: document.getElementById('lastName').value,
                username: document.getElementById('username').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                address: document.getElementById('address').value
            };
            
            try {
                const response = await fetch(`${BASE_URL}/api/user/update_profile.php`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
                    },
                    body: JSON.stringify(formData)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        showNotification('Profile updated successfully', 'success');
                        // Update current user data
                        currentUser = { ...currentUser, ...formData };
                        updateUIForLoggedInUser();
                    } else {
                        showNotification(result.message || 'Failed to update profile', 'danger');
                    }
                } else {
                    showNotification('Error updating profile', 'danger');
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                showNotification('Error updating profile', 'danger');
            }
        });
    }
    
    // Security form
    const securityForm = document.getElementById('securityForm');
    if (securityForm) {
        securityForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (newPassword !== confirmPassword) {
                showNotification('New passwords do not match', 'danger');
                return;
            }
            
            try {
                const response = await fetch(`${BASE_URL}/api/user/change_password.php`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
                    },
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        showNotification('Password updated successfully', 'success');
                        securityForm.reset();
                    } else {
                        showNotification(result.message || 'Failed to update password', 'danger');
                    }
                } else {
                    showNotification('Error updating password', 'danger');
                }
            } catch (error) {
                console.error('Error updating password:', error);
                showNotification('Error updating password', 'danger');
            }
        });
    }
    
    // Notifications form
    const notificationsForm = document.getElementById('notificationsForm');
    if (notificationsForm) {
        notificationsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const preferences = {
                email_notifications: document.getElementById('emailNotifications').checked,
                sms_notifications: document.getElementById('smsNotifications').checked,
                promotional_notifications: document.getElementById('promotionalNotifications').checked,
                trip_reminders: document.getElementById('tripReminders').checked
            };
            
            try {
                const response = await fetch(`${BASE_URL}/api/user/update_notifications.php`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
                    },
                    body: JSON.stringify(preferences)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        showNotification('Notification preferences updated successfully', 'success');
                    } else {
                        showNotification(result.message || 'Failed to update preferences', 'danger');
                    }
                } else {
                    showNotification('Error updating notification preferences', 'danger');
                }
            } catch (error) {
                console.error('Error updating notification preferences:', error);
                showNotification('Error updating notification preferences', 'danger');
            }
        });
    }
}

// View ticket details
function viewTicketDetails(bookingId) {
    // In a real application, this would open a modal or navigate to a ticket details page
    showNotification(`Loading ticket details for booking #${bookingId}`, 'info');
    
    // Simulate loading ticket details
    setTimeout(() => {
        showNotification('Ticket details loaded successfully', 'success');
    }, 1000);
}

// View booking details
function viewBookingDetails(bookingId) {
    // In a real application, this would open a modal or navigate to a booking details page
    showNotification(`Loading booking details for booking #${bookingId}`, 'info');
    
    // Simulate loading booking details
    setTimeout(() => {
        showNotification('Booking details loaded successfully', 'success');
    }, 1000);
}

// Cancel a booking
async function cancelBooking(bookingId) {
    try {
        const response = await fetch(`${BASE_URL}/api/user/cancel_booking.php`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            },
            body: JSON.stringify({ booking_id: bookingId })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showNotification('Booking cancelled successfully', 'success');
                // Reload the trips data
                loadTripsData();
                // Reload the dashboard data
                loadDashboardData();
            } else {
                showNotification(result.message || 'Failed to cancel booking', 'danger');
            }
        } else {
            showNotification('Error cancelling booking', 'danger');
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        showNotification('Error cancelling booking', 'danger');
    }
}

// Helper functions
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function getActivityIcon(type) {
    const icons = {
        'booking': 'fas fa-ticket-alt',
        'cancellation': 'fas fa-times-circle',
        'completion': 'fas fa-check-circle',
        'review': 'fas fa-star'
    };
    return icons[type] || 'fas fa-info-circle';
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

function getStatusClass(status) {
    const statusClasses = {
        'confirmed': 'bg-success',
        'pending': 'bg-warning text-dark',
        'cancelled': 'bg-danger',
        'completed': 'bg-info'
    };
    return statusClasses[status] || 'bg-secondary';
}

function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 150);
    }, 5000);
}