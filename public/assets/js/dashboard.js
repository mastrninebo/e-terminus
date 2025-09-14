const BASE_URL = window.location.origin + '/e-terminus';
let currentUser = null;
let confirmationCallback = null;
// API Paths - using absolute paths (keeping /api/passenger/ as requested)
const API_PATHS = {
    checkSession: `${BASE_URL}/api/auth/check_session.php`, // Note: Using check-session.php with hyphen
    getStats: `${BASE_URL}/api/passenger/get_stats.php`,
    getUpcomingTrips: `${BASE_URL}/api/passenger/get_upcoming_trips.php`,
    getRecentActivity: `${BASE_URL}/api/passenger/get_recent_activity.php`,
    getBookings: `${BASE_URL}/api/passenger/get_booking.php`,
    getCompletedTrips: `${BASE_URL}/api/passenger/get_completed_trips.php`,
    getReviews: `${BASE_URL}/api/passenger/get_reviews.php`,
    getPendingReviews: `${BASE_URL}/api/passenger/get_pending_reviews.php`,
    getSettings: `${BASE_URL}/api/passenger/get_settings.php`,
    updateProfile: `${BASE_URL}/api/passenger/update_profile.php`,
    changePassword: `${BASE_URL}/api/passenger/change_password.php`,
    updateNotifications: `${BASE_URL}/api/passenger/update_notifications.php`,
    cancelBooking: `${BASE_URL}/api/passenger/cancel_booking.php`,
    logout: `${BASE_URL}/api/auth/logout.php`
};
// Helper function to get cookies
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}
// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    // Check if we're on dashboard
    if (document.getElementById('sidebar')) {
        console.log('Setting up dashboard');
        checkAuthStatus();
        setupEventListeners();
        handleTabSwitching();
        setupLogoutButtons();
    }
});
// Check Authentication Status - FIXED to match working version
async function checkAuthStatus() {
    console.log('Checking passenger auth status...');
    
    try {
        const token = localStorage.getItem('auth_token') || getCookie('auth_token');
        console.log('Token exists:', !!token);
        
        const response = await fetch(API_PATHS.checkSession, {
            credentials: 'include',
            headers: token ? {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            } : {}
        });
        
        console.log('Session check response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Session data:', data);
            
            if (data.authenticated && data.user) {
                currentUser = data.user;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateUIForLoggedInUser();
                loadDashboardData();
            } else {
                console.log('Not authenticated, redirecting to login');
                window.location.href = `${BASE_URL}/public/login.html`;
            }
        } else {
            console.log('Authentication failed, redirecting to login');
            window.location.href = `${BASE_URL}/public/login.html`;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = `${BASE_URL}/public/login.html`;
    }
}
// Update UI for logged-in user
function updateUIForLoggedInUser() {
    if (!currentUser) {
        console.error('No current user data for UI update');
        return;
    }
    
    // Update user info in sidebar
    const sidebarName = document.querySelector('.sidebar h5');
    if (sidebarName) {
        sidebarName.textContent = currentUser.username || 'User';
    }
    
    const sidebarMemberSince = document.querySelector('.sidebar small');
    if (sidebarMemberSince) {
        sidebarMemberSince.textContent = `Member since ${new Date(currentUser.created_at || '2024').getFullYear()}`;
    }
    
    // Update user avatar
    const avatarImg = document.querySelector('.user-avatar');
    if (avatarImg) {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.username)}&background=random`;
        avatarImg.alt = currentUser.username;
    }
    
    console.log('UI update completed');
}
// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    const sidebar = document.getElementById('sidebar');
    const mobileToggle = document.getElementById('mobileMenuToggle');
    
    // Toggle sidebar on mobile
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
                sidebar && 
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
    
    console.log('Event listeners setup completed');
}
// Handle tab switching
function handleTabSwitching() {
    const tabPanes = document.querySelectorAll('.tab-pane');
    const navLinks = document.querySelectorAll('.nav-link[data-bs-toggle="tab"]'); // Only select links that are actually tabs
    
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const target = this.getAttribute('href');
            // Make sure target is valid before using it as a selector
            if (target && target !== '#' && target.startsWith('#')) {
                tabPanes.forEach(pane => pane.classList.remove('show', 'active'));
                const targetPane = document.querySelector(target);
                if (targetPane) {
                    targetPane.classList.add('show', 'active');
                }
            }
        });
    });
}
// Setup logout buttons
function setupLogoutButtons() {
    console.log('Setting up logout buttons');
    
    // Setup confirmation modal button
    const confirmButton = document.getElementById('confirmButton');
    if (confirmButton) {
        confirmButton.addEventListener('click', function() {
            // Hide the modal
            const confirmationModal = bootstrap.Modal.getInstance(document.getElementById('confirmationModal'));
            if (confirmationModal) {
                confirmationModal.hide();
            }
            
            // Execute the callback if it exists
            if (confirmationCallback) {
                confirmationCallback();
                confirmationCallback = null;
            }
        });
    }
    
    // Logout buttons - use querySelectorAll for safety
    const logoutButtons = document.querySelectorAll('#logoutBtn, #mobileLogoutBtn');
    console.log('Found logout buttons:', logoutButtons.length);
    
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Logout button clicked');
            showConfirmationModal('Are you sure you want to logout?', function() {
                performLogout();
            });
        });
    });
    
    console.log('Logout buttons setup completed');
}
// Load Dashboard Data
async function loadDashboardData() {
    console.log('Loading dashboard data...');
    
    if (!currentUser) {
        console.error('No current user data available');
        return;
    }
    
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
    // Remove loading indicators from stat cards if they exist
    document.querySelectorAll('#dashboard .stat-card h2').forEach(el => {
        if (el.innerHTML.includes('spinner-border')) {
            el.textContent = '0';
        }
    });
    
    // Remove loading indicator from next trip section if it exists
    const nextTripElement = document.querySelector('#dashboard .card.mb-4 .card-body .row');
    if (nextTripElement && nextTripElement.innerHTML.includes('spinner-border')) {
        nextTripElement.innerHTML = `
            <div class="col-12 text-center py-4">
                <p class="text-muted">No upcoming trips found</p>
            </div>
        `;
    }
    
    // Remove loading indicator from recent activity if it exists
    const activityContainer = document.querySelector('#dashboard .list-group');
    if (activityContainer && activityContainer.innerHTML.includes('spinner-border')) {
        activityContainer.innerHTML = `
            <div class="text-center py-4">
                <p class="text-muted">No recent activity</p>
            </div>
        `;
    }
}
// Load user statistics - IMPROVED error handling and DOM checks
async function loadUserStats() {
    console.log('Loading user stats...');
    
    try {
        const token = localStorage.getItem('auth_token') || getCookie('auth_token');
        console.log('Using token for getStats:', token ? 'Token present' : 'No token');
        
        const response = await fetch(API_PATHS.getStats, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('getStats response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('getStats error response:', errorText);
            showNotification(`Server error: ${errorText}`, 'danger');
            // Set default values and return
            setDefaultStatsValues();
            return;
        }
        
        const stats = await response.json();
        console.log('Stats data:', stats);
        
        // Check if stats is valid
        if (!stats || typeof stats !== 'object') {
            console.error('Invalid stats data received:', stats);
            showNotification('Invalid statistics data received from server', 'danger');
            setDefaultStatsValues();
            return;
        }
        
        // Update upcoming trips count - FIXED SELECTOR
        const upcomingTripsElement = document.querySelector('#dashboard .stat-card:nth-child(1) h2');
        if (upcomingTripsElement) {
            upcomingTripsElement.textContent = stats.upcoming_trips || 0;
        } else {
            console.warn('Upcoming trips element not found');
        }
        
        // Update completed trips count - FIXED SELECTOR
        const completedTripsElement = document.querySelector('#dashboard .stat-card:nth-child(2) h2');
        if (completedTripsElement) {
            completedTripsElement.textContent = stats.completed_trips || 0;
        } else {
            console.warn('Completed trips element not found');
        }
        
        // Update pending reviews count - FIXED SELECTOR
        const pendingReviewsElement = document.querySelector('#dashboard .stat-card:nth-child(3) h2');
        if (pendingReviewsElement) {
            pendingReviewsElement.textContent = stats.pending_reviews || 0;
        } else {
            console.warn('Pending reviews element not found');
        }
        
    } catch (error) {
        console.error('Error loading user stats:', error);
        showNotification(`Error loading stats: ${error.message}`, 'danger');
        setDefaultStatsValues();
    }
}
// Helper function to set default values
function setDefaultStatsValues() {
    console.log('Setting default stats values');
    
    const upcomingTripsElement = document.querySelector('#dashboard .stat-card:first-child h2');
    if (upcomingTripsElement) {
        upcomingTripsElement.textContent = '0';
    }
    
    const completedTripsElement = document.querySelector('#dashboard .stat-card:nth-child(2) h2');
    if (completedTripsElement) {
        completedTripsElement.textContent = '0';
    }
    
    const pendingReviewsElement = document.querySelector('#dashboard .stat-card:last-child h2');
    if (pendingReviewsElement) {
        pendingReviewsElement.textContent = '0';
    }
}
// Load upcoming trips
async function loadUpcomingTrips() {
    console.log('Loading upcoming trips...');
    
    try {
        const response = await fetch(API_PATHS.getUpcomingTrips, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (response.ok) {
            const trips = await response.json();
            console.log('Upcoming trips data:', trips);
            
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
    console.log('Loading recent activity...');
    
    try {
        const response = await fetch(API_PATHS.getRecentActivity, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (response.ok) {
            const activities = await response.json();
            console.log('Recent activity data:', activities);
            
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
// Load bookings data - FIXED API PATH and improved error handling
async function loadBookingsData() {
    console.log('Loading bookings data...');
    
    try {
        const response = await fetch(API_PATHS.getBookings, { // Now using get_booking.php (singular)
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        console.log('getBookings response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('getBookings error response:', errorText);
            showNotification(`Server error: ${errorText}`, 'danger');
            setDefaultBookingsValues();
            return;
        }
        
        const bookings = await response.json();
        console.log('Bookings data:', bookings);
        
        // Check if bookings is valid
        if (!bookings || !Array.isArray(bookings)) {
            console.error('Invalid bookings data received:', bookings);
            showNotification('Invalid bookings data received from server', 'danger');
            setDefaultBookingsValues();
            return;
        }
        
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
        } else {
            console.warn('Bookings table not found');
            setDefaultBookingsValues();
        }
        
    } catch (error) {
        console.error('Error loading bookings data:', error);
        showNotification(`Error loading bookings: ${error.message}`, 'danger');
        setDefaultBookingsValues();
    }
}
// Helper function to set default bookings values
function setDefaultBookingsValues() {
    const bookingsTable = document.querySelector('#bookings table tbody');
    if (bookingsTable) {
        bookingsTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-3 text-muted">Unable to load bookings</td>
            </tr>
        `;
    }
}
// Load trips data for My Trips tab
async function loadTripsData() {
    console.log('Loading trips data...');
    
    try {
        // Load upcoming trips
        const upcomingResponse = await fetch(API_PATHS.getUpcomingTrips, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (upcomingResponse.ok) {
            const upcomingTrips = await upcomingResponse.json();
            console.log('Upcoming trips data:', upcomingTrips);
            
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
        const completedResponse = await fetch(API_PATHS.getCompletedTrips, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (completedResponse.ok) {
            const completedTrips = await completedResponse.json();
            console.log('Completed trips data:', completedTrips);
            
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
    console.log('Loading reviews data...');
    
    try {
        // Load user reviews
        const reviewsResponse = await fetch(API_PATHS.getReviews, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (reviewsResponse.ok) {
            const reviews = await reviewsResponse.json();
            console.log('Reviews data:', reviews);
            
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
        const pendingResponse = await fetch(API_PATHS.getPendingReviews, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (pendingResponse.ok) {
            const pendingReviews = await pendingResponse.json();
            console.log('Pending reviews data:', pendingReviews);
            
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
    console.log('Loading user settings...');
    
    try {
        const response = await fetch(API_PATHS.getSettings, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || getCookie('auth_token')}`
            }
        });
        
        if (response.ok) {
            const settings = await response.json();
            console.log('Settings data:', settings);
            
            // Update profile form using safe functions
            setElementValue('username', settings.username);
            setElementValue('email', settings.email);
            setElementValue('phone', settings.phone);
            
            // Update read-only display fields
            setElementValue('userTypeDisplay', settings.user_type ? 
                settings.user_type.charAt(0).toUpperCase() + settings.user_type.slice(1) : 
                'Passenger');
            
            setElementValue('createdAtDisplay', settings.created_at ? 
                formatDate(settings.created_at) : 
                'Unknown');
            
            // Update notification preferences using safe functions
            setElementChecked('emailNotifications', settings.email_notifications !== false);
            setElementChecked('smsNotifications', settings.sms_notifications === true);
            setElementChecked('promotionalNotifications', settings.promotional_notifications !== false);
            setElementChecked('tripReminders', settings.trip_reminders !== false);
            
        } else {
            const errorText = await response.text();
            console.error('getSettings error response:', errorText);
            showNotification(`Error loading settings: ${errorText}`, 'danger');
        }
    } catch (error) {
        console.error('Error loading user settings:', error);
        showNotification(`Error loading settings: ${error.message}`, 'danger');
    }
}
// Setup settings form handlers
function setupSettingsForms() {
    console.log('Setting up settings forms...');
    
    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                username: document.getElementById('username').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value
            };
            
            try {
                const response = await fetch(API_PATHS.updateProfile, {
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
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
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
                const response = await fetch(API_PATHS.changePassword, {
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
                const response = await fetch(API_PATHS.updateNotifications, {
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
    
    console.log('Settings forms setup completed');
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
        const response = await fetch(API_PATHS.cancelBooking, {
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
// Function to show confirmation modal
function showConfirmationModal(message, callback) {
    // Set the message
    const confirmationMessage = document.getElementById('confirmationMessage');
    if (confirmationMessage) {
        confirmationMessage.textContent = message;
    }
    
    // Store the callback
    confirmationCallback = callback;
    
    // Show the modal with error handling
    try {
        const modalElement = document.getElementById('confirmationModal');
        if (!modalElement) {
            console.error('Confirmation modal element not found');
            // Fallback to native confirm
            if (confirm(message)) {
                callback();
            }
            return;
        }
        
        const confirmationModal = new bootstrap.Modal(modalElement);
        confirmationModal.show();
    } catch (error) {
        console.error('Error showing modal:', error);
        // Fallback to native confirm
        if (confirm(message)) {
            callback();
        }
    }
}
// Function to perform logout
function performLogout() {
    console.log("=== PASSENGER LOGOUT START ===");
    
    // Step 1: Get the token before clearing it
    const token = localStorage.getItem('auth_token') || getCookie('auth_token');
    
    // Step 2: Clear ALL authentication data from localStorage
    console.log("Clearing localStorage items...");
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userData');
    
    // Clear any other potential auth-related items
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('token') || key.includes('auth') || key.includes('user')) {
            console.log("Removing additional auth item:", key);
            localStorage.removeItem(key);
        }
    }
    
    // Step 3: Clear all authentication cookies
    console.log("Clearing cookies...");
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'PHPSESSID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    // Step 4: Call server logout endpoint to invalidate session
    console.log("Calling server logout endpoint...");
    fetch(API_PATHS.logout, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Logout request failed');
        }
        return response.json();
    })
    .then(data => {
        console.log('Server logout response:', data);
    })
    .catch(error => {
        console.error('Error during server logout:', error);
    })
    .finally(() => {
        console.log("=== PASSENGER LOGOUT COMPLETE ===");
        
        // Step 5: Force redirect to home page with cache-busting
        console.log("Redirecting to home page...");
        window.location.href = `${BASE_URL}/index.html?` + new Date().getTime();
    });
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
// Safe element value setter function
function setElementValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.value = value || '';
    } else {
        console.warn(`Element with id '${elementId}' not found`);
    }
}

// Safe element checked setter function
function setElementChecked(elementId, checked) {
    const element = document.getElementById(elementId);
    if (element) {
        element.checked = !!checked;
    } else {
        console.warn(`Element with id '${elementId}' not found`);
    }
}
// Global error handlers
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showNotification('An unexpected error occurred', 'danger');
});
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('An unexpected error occurred', 'danger');
});