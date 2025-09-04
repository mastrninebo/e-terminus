const BASE_URL = window.location.origin + '/e-terminus';
let currentUser = null;

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuthStatus();
    setupEventListeners();
});

// Check if admin is authenticated
async function checkAdminAuthStatus() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            redirectToLogin();
            return;
        }
        
        const response = await fetch(`${BASE_URL}/api/auth/check_session.php`, {
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
                currentUser = data.user;
                updateUIForLoggedInAdmin();
                loadDashboardData();
            } else {
                redirectToLogin();
            }
        } else {
            redirectToLogin();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        redirectToLogin();
    }
}

// Redirect to login page
function redirectToLogin() {
    localStorage.removeItem('auth_token');
    window.location.href = 'login.html';
}

// Update UI for logged-in admin
function updateUIForLoggedInAdmin() {
    if (!currentUser) return;
    
    // Update admin name in sidebar
    const adminNameElement = document.getElementById('adminName');
    if (adminNameElement) {
        adminNameElement.textContent = currentUser.username || 'Admin';
    }
    
    // Update welcome message
    const welcomeUsernameElement = document.getElementById('welcomeUsername');
    if (welcomeUsernameElement) {
        welcomeUsernameElement.textContent = currentUser.username || 'Admin';
    }
}

// Setup event listeners
function setupEventListeners() {
    const sidebar = document.getElementById('sidebar');
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const mainContent = document.getElementById('mainContent');
    
    // Toggle sidebar on mobile
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
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
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
            } else if (target === '#users') {
                loadUsersData();
            } else if (target === '#reviews') {
                loadReviewsData();
            }
        });
    });
    
    // Save trip button
    const saveTripBtn = document.getElementById('saveTripBtn');
    if (saveTripBtn) {
        saveTripBtn.addEventListener('click', function() {
            const route = document.getElementById('tripRoute').value;
            const departureTime = document.getElementById('departureTime').value;
            const totalSeats = document.getElementById('totalSeats').value;
            const price = document.getElementById('price').value;
            
            // Here you would normally save the trip to your database
            showNotification('Trip saved successfully', 'success');
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('addTripModal'));
            modal.hide();
            document.getElementById('addTripForm').reset();
            
            // Reload trips data
            loadTripsData();
        });
    }
}

// Load dashboard data
async function loadDashboardData() {
    if (!currentUser) return;
    
    try {
        // Load statistics
        await loadAdminStats();
        
        // Load recent bookings
        await loadRecentBookings();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'danger');
    }
}

// Load admin statistics
async function loadAdminStats() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/admin/get_stats.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            
            // Update statistics cards
            if (stats.total_trips !== undefined) {
                document.getElementById('totalTrips').textContent = stats.total_trips;
            } else {
                console.error('total_trips not found in response');
            }
            
            if (stats.active_bookings !== undefined) {
                document.getElementById('activeBookings').textContent = stats.active_bookings;
            } else {
                console.error('active_bookings not found in response');
            }
            
            if (stats.pending_reviews !== undefined) {
                document.getElementById('pendingReviews').textContent = stats.pending_reviews;
            } else {
                console.error('pending_reviews not found in response');
            }
        } else {
            const errorData = await response.json();
            console.error('Error loading admin stats:', errorData.error || 'Unknown error');
            showNotification('Error loading dashboard statistics', 'danger');
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
        showNotification('Error loading dashboard statistics', 'danger');
    }
}

// Load recent bookings
async function loadRecentBookings() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/admin/get_recent_bookings.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const bookings = await response.json();
            const bookingsTable = document.getElementById('recentBookingsTable');
            
            if (bookingsTable && bookings.length > 0) {
                let bookingsHtml = '';
                bookings.forEach(booking => {
                    bookingsHtml += `
                        <tr>
                            <td>#${booking.booking_id}</td>
                            <td>${booking.username}</td>
                            <td>${booking.route}</td>
                            <td>${formatDate(booking.booking_date)}</td>
                            <td><span class="badge bg-${getStatusClass(booking.booking_status)}">${booking.booking_status}</span></td>
                        </tr>
                    `;
                });
                
                bookingsTable.innerHTML = bookingsHtml;
            } else if (bookingsTable) {
                bookingsTable.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-muted">No recent bookings</td>
                    </tr>
                `;
            }
        } else {
            const errorData = await response.json();
            console.error('Error loading recent bookings:', errorData.error || 'Unknown error');
            showNotification('Error loading recent bookings', 'danger');
        }
    } catch (error) {
        console.error('Error loading recent bookings:', error);
        showNotification('Error loading recent bookings', 'danger');
    }
}

// Load trips data
async function loadTripsData() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/admin/get_trips.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const trips = await response.json();
            const tripsTable = document.getElementById('tripsTable');
            
            if (tripsTable && trips.length > 0) {
                let tripsHtml = '';
                trips.forEach(trip => {
                    tripsHtml += `
                        <tr>
                            <td>${trip.schedule_id}</td>
                            <td>${trip.route}</td>
                            <td>${formatDateTime(trip.departure_time)}</td>
                            <td>${trip.available_seats}</td>
                            <td>${trip.price}</td>
                            <td>
                                <button class="btn btn-sm btn-info action-btn"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger action-btn"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
                
                tripsTable.innerHTML = tripsHtml;
            } else if (tripsTable) {
                tripsTable.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted">No trips found</td>
                    </tr>
                `;
            }
        } else {
            const errorData = await response.json();
            console.error('Error loading trips data:', errorData.error || 'Unknown error');
            showNotification('Error loading trips data', 'danger');
        }
    } catch (error) {
        console.error('Error loading trips data:', error);
        showNotification('Error loading trips data', 'danger');
    }
}

// Load bookings data
async function loadBookingsData() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/admin/get_all_bookings.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const bookings = await response.json();
            const bookingsTable = document.getElementById('bookingsTable');
            
            if (bookingsTable && bookings.length > 0) {
                let bookingsHtml = '';
                bookings.forEach(booking => {
                    bookingsHtml += `
                        <tr>
                            <td>#${booking.booking_id}</td>
                            <td>${booking.username}</td>
                            <td>${booking.route}</td>
                            <td>${booking.amount}</td>
                            <td><span class="badge bg-${getStatusClass(booking.booking_status)}">${booking.booking_status}</span></td>
                            <td><span class="badge bg-${getPaymentStatusClass(booking.payment_status)}">${booking.payment_status}</span></td>
                            <td>
                                <button class="btn btn-sm btn-info action-btn"><i class="fas fa-eye"></i></button>
                                <button class="btn btn-sm btn-danger action-btn"><i class="fas fa-times"></i></button>
                            </td>
                        </tr>
                    `;
                });
                
                bookingsTable.innerHTML = bookingsHtml;
            } else if (bookingsTable) {
                bookingsTable.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted">No bookings found</td>
                    </tr>
                `;
            }
        } else {
            const errorData = await response.json();
            console.error('Error loading bookings data:', errorData.error || 'Unknown error');
            showNotification('Error loading bookings data', 'danger');
        }
    } catch (error) {
        console.error('Error loading bookings data:', error);
        showNotification('Error loading bookings data', 'danger');
    }
}

// Load users data
async function loadUsersData() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/admin/get_users.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            const usersTable = document.getElementById('usersTable');
            
            if (usersTable && users.length > 0) {
                let usersHtml = '';
                users.forEach(user => {
                    usersHtml += `
                        <tr>
                            <td>${user.user_id}</td>
                            <td>${user.username}</td>
                            <td>${user.email}</td>
                            <td><span class="badge badge-gradient-primary">${user.user_type}</span></td>
                            <td>
                                <button class="btn btn-sm btn-info action-btn"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger action-btn"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
                
                usersTable.innerHTML = usersHtml;
            } else if (usersTable) {
                usersTable.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-muted">No users found</td>
                    </tr>
                `;
            }
        } else {
            const errorData = await response.json();
            console.error('Error loading users data:', errorData.error || 'Unknown error');
            showNotification('Error loading users data', 'danger');
        }
    } catch (error) {
        console.error('Error loading users data:', error);
        showNotification('Error loading users data', 'danger');
    }
}

// Load reviews data
async function loadReviewsData() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/admin/get_reviews.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const reviews = await response.json();
            const reviewsTable = document.getElementById('reviewsTable');
            
            if (reviewsTable && reviews.length > 0) {
                let reviewsHtml = '';
                reviews.forEach(review => {
                    reviewsHtml += `
                        <tr>
                            <td>${review.review_id}</td>
                            <td>${review.username}</td>
                            <td>${review.title || 'No title'}</td>
                            <td>${generateStarRating(review.rating)}</td>
                            <td><span class="badge bg-${getReviewStatusClass(review.is_approved)}">${review.is_approved ? 'Approved' : 'Pending'}</span></td>
                            <td>${formatDate(review.review_date)}</td>
                            <td>
                                <button class="btn btn-sm btn-success action-btn approve-review" data-id="${review.review_id}"><i class="fas fa-check"></i></button>
                                <button class="btn btn-sm btn-danger action-btn reject-review" data-id="${review.review_id}"><i class="fas fa-times"></i></button>
                            </td>
                        </tr>
                    `;
                });
                
                reviewsTable.innerHTML = reviewsHtml;
                
                // Add event listeners to approve/reject buttons
                document.querySelectorAll('.approve-review').forEach(button => {
                    button.addEventListener('click', function() {
                        const reviewId = this.getAttribute('data-id');
                        approveReview(reviewId);
                    });
                });
                
                document.querySelectorAll('.reject-review').forEach(button => {
                    button.addEventListener('click', function() {
                        const reviewId = this.getAttribute('data-id');
                        rejectReview(reviewId);
                    });
                });
                
            } else if (reviewsTable) {
                reviewsTable.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted">No reviews found</td>
                    </tr>
                `;
            }
        } else {
            const errorData = await response.json();
            console.error('Error loading reviews data:', errorData.error || 'Unknown error');
            showNotification('Error loading reviews data', 'danger');
        }
    } catch (error) {
        console.error('Error loading reviews data:', error);
        showNotification('Error loading reviews data', 'danger');
    }
}

// Approve a review
async function approveReview(reviewId) {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/admin/approve_review.php`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                review_id: reviewId,
                action: 'approve'
            })
        });
        
        if (response.ok) {
            showNotification('Review approved successfully', 'success');
            loadReviewsData(); // Reload reviews data
        } else {
            const errorData = await response.json();
            console.error('Error approving review:', errorData.error || 'Unknown error');
            showNotification('Error approving review', 'danger');
        }
    } catch (error) {
        console.error('Error approving review:', error);
        showNotification('Error approving review', 'danger');
    }
}

// Reject a review
async function rejectReview(reviewId) {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/admin/approve_review.php`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                review_id: reviewId,
                action: 'reject'
            })
        });
        
        if (response.ok) {
            showNotification('Review rejected successfully', 'success');
            loadReviewsData(); // Reload reviews data
        } else {
            const errorData = await response.json();
            console.error('Error rejecting review:', errorData.error || 'Unknown error');
            showNotification('Error rejecting review', 'danger');
        }
    } catch (error) {
        console.error('Error rejecting review:', error);
        showNotification('Error rejecting review', 'danger');
    }
}

// Logout admin
async function logout() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/auth/logout.php`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Clear local storage
        localStorage.removeItem('auth_token');
        
        // Redirect to admin login
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Error logging out', 'danger');
    }
}

// Helper functions
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function formatDateTime(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function getStatusClass(status) {
    const statusClasses = {
        'confirmed': 'success',
        'pending': 'warning text-dark',
        'cancelled': 'danger',
        'completed': 'info'
    };
    return statusClasses[status] || 'secondary';
}

function getPaymentStatusClass(status) {
    const statusClasses = {
        'pending': 'warning text-dark',
        'success': 'success',
        'failed': 'danger'
    };
    return statusClasses[status] || 'secondary';
}

function getReviewStatusClass(isApproved) {
    return isApproved ? 'success' : 'warning text-dark';
}

function generateStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star text-warning"></i>';
        } else {
            stars += '<i class="far fa-star text-warning"></i>';
        }
    }
    return stars;
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