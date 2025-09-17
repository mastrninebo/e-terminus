const BASE_URL = window.location.origin + '/e-terminus';
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuthStatus();
    setupEventListeners();
    setupPasswordToggles();
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
    
    // Update operator button
    const updateOperatorBtn = document.getElementById('updateOperatorBtn');
    if (updateOperatorBtn) {
        updateOperatorBtn.addEventListener('click', updateOperator);
    }
    
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
            } else if (target === '#operators') {
                loadOperatorsData();
            } else if (target === '#reviews') {
                loadReviewsData();
            }
        });
    });
    
    // Save trip button
    const saveTripBtn = document.getElementById('saveTripBtn');
    if (saveTripBtn) {
        saveTripBtn.addEventListener('click', saveTrip);
    }
    
    // Save operator button
    const saveOperatorBtn = document.getElementById('saveOperatorBtn');
    if (saveOperatorBtn) {
        saveOperatorBtn.addEventListener('click', saveOperator);
    }
}

function setupPasswordToggles() {
    // Get all toggle password buttons
    const toggleButtons = document.querySelectorAll('.toggle-password');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Get the input field (previous element sibling of the button)
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            
            // Toggle the input type between password and text
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
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
        console.log('Loading admin stats with token:', token ? 'Token present' : 'No token');
        
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
            console.log('Stats data:', stats);
            
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
            showNotification('Error loading dashboard statistics: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
        showNotification('Error loading dashboard statistics: ' + error.message, 'danger');
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
            showNotification('Error loading recent bookings: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading recent bookings:', error);
        showNotification('Error loading recent bookings: ' + error.message, 'danger');
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
                                <button class="btn btn-sm btn-info action-btn edit-trip" data-id="${trip.schedule_id}" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger action-btn delete-trip" data-id="${trip.schedule_id}" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                tripsTable.innerHTML = tripsHtml;
                
                // Add event listeners to edit/delete buttons
                document.querySelectorAll('.edit-trip').forEach(button => {
                    button.addEventListener('click', function() {
                        const tripId = this.getAttribute('data-id');
                        editTrip(tripId);
                    });
                });
                
                document.querySelectorAll('.delete-trip').forEach(button => {
                    button.addEventListener('click', function() {
                        const tripId = this.getAttribute('data-id');
                        deleteTrip(tripId);
                    });
                });
                
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
            showNotification('Error loading trips data: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading trips data:', error);
        showNotification('Error loading trips data: ' + error.message, 'danger');
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
                                <button class="btn btn-sm btn-info action-btn view-booking" data-id="${booking.booking_id}" title="View">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-danger action-btn cancel-booking" data-id="${booking.booking_id}" title="Cancel">
                                    <i class="fas fa-times"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                bookingsTable.innerHTML = bookingsHtml;
                
                // Add event listeners to view/cancel buttons
                document.querySelectorAll('.view-booking').forEach(button => {
                    button.addEventListener('click', function() {
                        const bookingId = this.getAttribute('data-id');
                        viewBooking(bookingId);
                    });
                });
                
                document.querySelectorAll('.cancel-booking').forEach(button => {
                    button.addEventListener('click', function() {
                        const bookingId = this.getAttribute('data-id');
                        cancelBooking(bookingId);
                    });
                });
                
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
            showNotification('Error loading bookings data: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading bookings data:', error);
        showNotification('Error loading bookings data: ' + error.message, 'danger');
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
                                <button class="btn btn-sm btn-info action-btn edit-user" data-id="${user.user_id}" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger action-btn delete-user" data-id="${user.user_id}" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                usersTable.innerHTML = usersHtml;
                
                // Add event listeners to edit/delete buttons
                document.querySelectorAll('.edit-user').forEach(button => {
                    button.addEventListener('click', function() {
                        const userId = this.getAttribute('data-id');
                        editUser(userId);
                    });
                });
                
                document.querySelectorAll('.delete-user').forEach(button => {
                    button.addEventListener('click', function() {
                        const userId = this.getAttribute('data-id');
                        deleteUser(userId);
                    });
                });
                
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
            showNotification('Error loading users data: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading users data:', error);
        showNotification('Error loading users data: ' + error.message, 'danger');
    }
}

// Load operators data
async function loadOperatorsData() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${BASE_URL}/api/admin/get_operators.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const operators = await response.json();
            const operatorsTable = document.getElementById('operatorsTable');
            
            if (operatorsTable && operators.length > 0) {
                let operatorsHtml = '';
                operators.forEach(operator => {
                    // Determine verification status badge class
                    let verificationBadgeClass = 'warning text-dark';
                    let verificationText = 'Pending';
                    
                    if (operator.verification_status === 'verified') {
                        verificationBadgeClass = 'success';
                        verificationText = 'Verified';
                    } else if (operator.verification_status === 'rejected') {
                        verificationBadgeClass = 'danger';
                        verificationText = 'Rejected';
                    }
                    
                    operatorsHtml += `
                        <tr>
                            <td><strong>${operator.operator_code || operator.operator_id}</strong></td>
                            <td>${operator.company_name}</td>
                            <td>${operator.contact_person || 'N/A'}</td>
                            <td>${operator.email}</td>
                            <td><span class="badge bg-${operator.status === 'active' ? 'success' : 'danger'}">${operator.status}</span></td>
                            <td><span class="badge bg-${verificationBadgeClass}">${verificationText}</span></td>
                            <td>
                                ${operator.verification_status === 'pending' ? `
                                    <button class="btn btn-sm btn-success action-btn verify-operator" data-id="${operator.operator_id}" title="Verify">
                                        <i class="fas fa-check"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger action-btn reject-operator" data-id="${operator.operator_id}" title="Reject">
                                        <i class="fas fa-times"></i>
                                    </button>
                                ` : ''}
                                <button class="btn btn-sm btn-info action-btn edit-operator" data-id="${operator.operator_id}" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger action-btn delete-operator" data-id="${operator.operator_id}" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                operatorsTable.innerHTML = operatorsHtml;
                
                // Add event listeners to verify/reject buttons
                document.querySelectorAll('.verify-operator').forEach(button => {
                    button.addEventListener('click', function() {
                        const operatorId = this.getAttribute('data-id');
                        verifyOperator(operatorId);
                    });
                });
                
                document.querySelectorAll('.reject-operator').forEach(button => {
                    button.addEventListener('click', function() {
                        const operatorId = this.getAttribute('data-id');
                        rejectOperator(operatorId);
                    });
                });
                
                // Add event listeners to edit/delete buttons
                document.querySelectorAll('.edit-operator').forEach(button => {
                    button.addEventListener('click', function() {
                        const operatorId = this.getAttribute('data-id');
                        editOperator(operatorId);
                    });
                });
                
                document.querySelectorAll('.delete-operator').forEach(button => {
                    button.addEventListener('click', function() {
                        const operatorId = this.getAttribute('data-id');
                        deleteOperator(operatorId);
                    });
                });
                
            } else if (operatorsTable) {
                operatorsTable.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted">No operators found</td>
                    </tr>
                `;
            }
        } else {
            const errorData = await response.json();
            console.error('Error loading operators data:', errorData.error || 'Unknown error');
            showNotification('Error loading operators data', 'danger');
        }
    } catch (error) {
        console.error('Error loading operators data:', error);
        showNotification('Error loading operators data', 'danger');
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
                                <button class="btn btn-sm btn-success action-btn approve-review" data-id="${review.review_id}" title="Approve">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="btn btn-sm btn-danger action-btn reject-review" data-id="${review.review_id}" title="Reject">
                                    <i class="fas fa-times"></i>
                                </button>
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

// Save trip
async function saveTrip() {
    try {
        const token = localStorage.getItem('auth_token');
        
        // Get form data
        const tripData = {
            route: document.getElementById('tripRoute').value,
            departureTime: document.getElementById('departureTime').value,
            totalSeats: document.getElementById('totalSeats').value,
            price: document.getElementById('price').value
        };
        
        const response = await fetch(`${BASE_URL}/api/admin/create_trip.php`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tripData)
        });
        
        if (response.ok) {
            showNotification('Trip saved successfully', 'success');
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('addTripModal'));
            modal.hide();
            document.getElementById('addTripForm').reset();
            
            // Reload trips data
            loadTripsData();
        } else {
            const errorData = await response.json();
            showNotification('Error saving trip: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error saving trip:', error);
        showNotification('Error saving trip: ' + error.message, 'danger');
    }
}

// Edit trip function
async function editTrip(tripId) {
    try {
        const token = localStorage.getItem('auth_token');
        
        // Get current trip data
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
            const trip = trips.find(t => t.schedule_id == tripId);
            
            if (trip) {
                // Populate the edit form
                document.getElementById('editTripId').value = trip.schedule_id;
                document.getElementById('editTripRoute').value = trip.route;
                document.getElementById('editDepartureTime').value = formatDateTimeForInput(trip.departure_time);
                document.getElementById('editTotalSeats').value = trip.total_seats;
                document.getElementById('editPrice').value = trip.price;
                
                // Show the edit modal
                const modal = new bootstrap.Modal(document.getElementById('editTripModal'));
                modal.show();
            } else {
                showNotification('Trip not found', 'danger');
            }
        } else {
            const errorData = await response.json();
            showNotification('Error fetching trip data: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error editing trip:', error);
        showNotification('Error editing trip: ' + error.message, 'danger');
    }
}

// Update trip function
async function updateTrip() {
    try {
        const token = localStorage.getItem('auth_token');
        const tripId = document.getElementById('editTripId').value;
        
        const tripData = {
            route: document.getElementById('editTripRoute').value,
            departureTime: document.getElementById('editDepartureTime').value,
            totalSeats: document.getElementById('editTotalSeats').value,
            price: document.getElementById('editPrice').value
        };
        
        const response = await fetch(`${BASE_URL}/api/admin/update_trip.php?trip_id=${tripId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tripData)
        });
        
        if (response.ok) {
            showNotification('Trip updated successfully', 'success');
            
            // Close modal and reload data
            const modal = bootstrap.Modal.getInstance(document.getElementById('editTripModal'));
            modal.hide();
            loadTripsData();
        } else {
            const errorData = await response.json();
            showNotification('Error updating trip: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error updating trip:', error);
        showNotification('Error updating trip: ' + error.message, 'danger');
    }
}

// Delete trip function
async function deleteTrip(tripId) {
    // Show custom confirmation modal instead of browser's confirm
    const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmButton = document.getElementById('confirmButton');
    
    // Set the confirmation message
    confirmationMessage.textContent = 'Are you sure you want to delete this trip? This action cannot be undone.';
    
    // Remove any existing event listeners
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    
    // Add event listener to the confirm button
    newConfirmButton.addEventListener('click', async function() {
        try {
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch(`${BASE_URL}/api/admin/delete_trip.php?trip_id=${tripId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (response.ok) {
                showNotification('Trip deleted successfully', 'success');
                loadTripsData();
            } else {
                const errorData = await response.json();
                showNotification('Error deleting trip: ' + (errorData.error || 'Unknown error'), 'danger');
            }
        } catch (error) {
            console.error('Error deleting trip:', error);
            showNotification('Error deleting trip: ' + error.message, 'danger');
        } finally {
            // Hide the confirmation modal
            confirmationModal.hide();
        }
    });
    
    // Show the confirmation modal
    confirmationModal.show();
}

// View booking function
async function viewBooking(bookingId) {
    try {
        const token = localStorage.getItem('auth_token');
        
        // Get all bookings data (since we don't have a specific get_booking endpoint)
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
            const booking = bookings.find(b => b.booking_id == bookingId);
            
            if (booking) {
                // Populate the view modal
                document.getElementById('viewBookingId').textContent = '#' + booking.booking_id;
                document.getElementById('viewBookingUser').textContent = booking.username;
                document.getElementById('viewBookingRoute').textContent = booking.route;
                document.getElementById('viewBookingDeparture').textContent = booking.departure_time ? formatDateTime(booking.departure_time) : 'N/A';
                document.getElementById('viewBookingAmount').textContent = booking.amount;
                document.getElementById('viewBookingStatus').innerHTML = `<span class="badge bg-${getStatusClass(booking.booking_status)}">${booking.booking_status}</span>`;
                document.getElementById('viewBookingPaymentStatus').innerHTML = `<span class="badge bg-${getPaymentStatusClass(booking.payment_status)}">${booking.payment_status}</span>`;
                document.getElementById('viewBookingDate').textContent = booking.booking_date ? formatDateTime(booking.booking_date) : 'N/A';
                
                // Show the view modal
                const modal = new bootstrap.Modal(document.getElementById('viewBookingModal'));
                modal.show();
            } else {
                showNotification('Booking not found', 'danger');
            }
        } else {
            const errorData = await response.json();
            showNotification('Error fetching booking data: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error viewing booking:', error);
        showNotification('Error viewing booking: ' + error.message, 'danger');
    }
}

// Cancel booking function
async function cancelBooking(bookingId) {
    // Show custom confirmation modal instead of browser's confirm
    const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmButton = document.getElementById('confirmButton');
    
    // Set the confirmation message
    confirmationMessage.textContent = 'Are you sure you want to cancel this booking? This action cannot be undone.';
    
    // Remove any existing event listeners
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    
    // Add event listener to the confirm button
    newConfirmButton.addEventListener('click', async function() {
        try {
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch(`${BASE_URL}/api/admin/cancel_booking.php?booking_id=${bookingId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'cancelled' })
            });
            
            if (response.ok) {
                showNotification('Booking cancelled successfully', 'success');
                loadBookingsData();
            } else {
                const errorData = await response.json();
                showNotification('Error cancelling booking: ' + (errorData.error || 'Unknown error'), 'danger');
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            showNotification('Error cancelling booking: ' + error.message, 'danger');
        } finally {
            // Hide the confirmation modal
            confirmationModal.hide();
        }
    });
    
    // Show the confirmation modal
    confirmationModal.show();
}

// Edit user function
async function editUser(userId) {
    try {
        const token = localStorage.getItem('auth_token');
        
        // Get current user data
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
            const user = users.find(u => u.user_id == userId);
            
            if (user) {
                // Populate the edit form
                document.getElementById('editUserId').value = user.user_id;
                document.getElementById('editUsername').value = user.username;
                document.getElementById('editEmail').value = user.email;
                document.getElementById('editUserType').value = user.user_type;
                
                // Show the edit modal
                const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
                modal.show();
            } else {
                showNotification('User not found', 'danger');
            }
        } else {
            const errorData = await response.json();
            showNotification('Error fetching user data: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error editing user:', error);
        showNotification('Error editing user: ' + error.message, 'danger');
    }
}

// Update user function
async function updateUser() {
    try {
        const token = localStorage.getItem('auth_token');
        const userId = document.getElementById('editUserId').value;
        
        const userData = {
            username: document.getElementById('editUsername').value,
            email: document.getElementById('editEmail').value,
            userType: document.getElementById('editUserType').value
        };
        
        const response = await fetch(`${BASE_URL}/api/admin/update_user.php?user_id=${userId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            showNotification('User updated successfully', 'success');
            
            // Close modal and reload data
            const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
            modal.hide();
            loadUsersData();
        } else {
            const errorData = await response.json();
            showNotification('Error updating user: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Error updating user: ' + error.message, 'danger');
    }
}

// Delete user function
async function deleteUser(userId) {
    // Show custom confirmation modal instead of browser's confirm
    const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmButton = document.getElementById('confirmButton');
    
    // Set the confirmation message
    confirmationMessage.textContent = 'Are you sure you want to delete this user? This action cannot be undone.';
    
    // Remove any existing event listeners
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    
    // Add event listener to the confirm button
    newConfirmButton.addEventListener('click', async function() {
        try {
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch(`${BASE_URL}/api/admin/delete_user.php?user_id=${userId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (response.ok) {
                showNotification('User deleted successfully', 'success');
                loadUsersData();
            } else {
                const errorData = await response.json();
                showNotification('Error deleting user: ' + (errorData.error || 'Unknown error'), 'danger');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showNotification('Error deleting user: ' + error.message, 'danger');
        } finally {
            // Hide the confirmation modal
            confirmationModal.hide();
        }
    });
    
    // Show the confirmation modal
    confirmationModal.show();
}

// Save operator
async function saveOperator() {
    try {
        const token = localStorage.getItem('auth_token');
        
        // Get form data
        const operatorData = {
            username: document.getElementById('operatorUsername').value,
            email: document.getElementById('operatorEmail').value,
            password: document.getElementById('operatorPassword').value,
            confirmPassword: document.getElementById('operatorConfirmPassword').value,
            phone: document.getElementById('operatorPhone').value,
            companyName: document.getElementById('companyName').value,
            contactPerson: document.getElementById('contactPerson').value,
            status: document.getElementById('operatorStatus').value
        };
        
        const response = await fetch(`${BASE_URL}/api/admin/create_operator.php`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(operatorData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Operator created successfully with code: ${result.operator_code}`, 'success');
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('addOperatorModal'));
            modal.hide();
            document.getElementById('addOperatorForm').reset();
            
            // Reload operators data
            loadOperatorsData();
        } else {
            const errorData = await response.json();
            console.error('Error creating operator:', errorData.error || 'Unknown error');
            showNotification('Error creating operator: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error creating operator:', error);
        showNotification('Error creating operator: ' + error.message, 'danger');
    }
}

// Edit operator function
async function editOperator(operatorId) {
    try {
        const token = localStorage.getItem('auth_token');
        
        // Get current operator data
        const response = await fetch(`${BASE_URL}/api/admin/get_operators.php`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const operators = await response.json();
            const operator = operators.find(op => op.operator_id == operatorId);
            
            if (operator) {
                // Populate the edit form
                document.getElementById('editOperatorId').value = operator.operator_id;
                document.getElementById('editOperatorCode').value = operator.operator_code || '';
                document.getElementById('editCompanyName').value = operator.company_name;
                document.getElementById('editContactPerson').value = operator.contact_person || '';
                document.getElementById('editOperatorStatus').value = operator.status;
                document.getElementById('editOperatorVerificationStatus').value = operator.verification_status || 'pending';
                
                // Show the edit modal
                const modal = new bootstrap.Modal(document.getElementById('editOperatorModal'));
                modal.show();
            } else {
                showNotification('Operator not found', 'danger');
            }
        } else {
            const errorData = await response.json();
            showNotification('Error fetching operator data: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error editing operator:', error);
        showNotification('Error editing operator: ' + error.message, 'danger');
    }
}

// Update operator function
async function updateOperator() {
    try {
        const token = localStorage.getItem('auth_token');
        const operatorId = document.getElementById('editOperatorId').value;
        
        const operatorData = {
            companyName: document.getElementById('editCompanyName').value,
            contactPerson: document.getElementById('editContactPerson').value,
            status: document.getElementById('editOperatorStatus').value,
            verificationStatus: document.getElementById('editOperatorVerificationStatus').value
        };
        
        const response = await fetch(`${BASE_URL}/api/admin/update_operator.php?operator_id=${operatorId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(operatorData)
        });
        
        if (response.ok) {
            showNotification('Operator updated successfully', 'success');
            
            // Close modal and reload data
            const modal = bootstrap.Modal.getInstance(document.getElementById('editOperatorModal'));
            modal.hide();
            loadOperatorsData();
        } else {
            const errorData = await response.json();
            showNotification('Error updating operator: ' + (errorData.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error updating operator:', error);
        showNotification('Error updating operator: ' + error.message, 'danger');
    }
}

// Delete operator function
async function deleteOperator(operatorId) {
    // Show custom confirmation modal instead of browser's confirm
    const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmButton = document.getElementById('confirmButton');
    
    // Set the confirmation message
    confirmationMessage.textContent = 'Are you sure you want to delete this operator? This action cannot be undone.';
    
    // Remove any existing event listeners
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    
    // Add event listener to the confirm button
    newConfirmButton.addEventListener('click', async function() {
        try {
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch(`${BASE_URL}/api/admin/delete_operator.php?operator_id=${operatorId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (response.ok) {
                showNotification('Operator deleted successfully', 'success');
                loadOperatorsData();
            } else {
                const errorData = await response.json();
                showNotification('Error deleting operator: ' + (errorData.error || 'Unknown error'), 'danger');
            }
        } catch (error) {
            console.error('Error deleting operator:', error);
            showNotification('Error deleting operator: ' + error.message, 'danger');
        } finally {
            // Hide the confirmation modal
            confirmationModal.hide();
        }
    });
    
    // Show the confirmation modal
    confirmationModal.show();
}

// Verify operator function
async function verifyOperator(operatorId) {
    // Show custom confirmation modal
    const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmButton = document.getElementById('confirmButton');
    
    // Set the confirmation message
    confirmationMessage.textContent = 'Are you sure you want to verify this operator?';
    
    // Remove any existing event listeners
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    
    // Add event listener to the confirm button
    newConfirmButton.addEventListener('click', async function() {
        try {
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch(`${BASE_URL}/api/admin/verify_operator.php?operator_id=${operatorId}&action=verify`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (response.ok) {
                showNotification('Operator verified successfully', 'success');
                loadOperatorsData();
            } else {
                const errorData = await response.json();
                showNotification('Error verifying operator: ' + (errorData.error || 'Unknown error'), 'danger');
            }
        } catch (error) {
            console.error('Error verifying operator:', error);
            showNotification('Error verifying operator: ' + error.message, 'danger');
        } finally {
            // Hide the confirmation modal
            confirmationModal.hide();
        }
    });
    
    // Show the confirmation modal
    confirmationModal.show();
}

// Reject operator function
async function rejectOperator(operatorId) {
    // Show custom confirmation modal
    const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmButton = document.getElementById('confirmButton');
    
    // Set the confirmation message
    confirmationMessage.textContent = 'Are you sure you want to reject this operator?';
    
    // Remove any existing event listeners
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    
    // Add event listener to the confirm button
    newConfirmButton.addEventListener('click', async function() {
        try {
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch(`${BASE_URL}/api/admin/verify_operator.php?operator_id=${operatorId}&action=reject`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (response.ok) {
                showNotification('Operator rejected successfully', 'success');
                loadOperatorsData();
            } else {
                const errorData = await response.json();
                showNotification('Error rejecting operator: ' + (errorData.error || 'Unknown error'), 'danger');
            }
        } catch (error) {
            console.error('Error rejecting operator:', error);
            showNotification('Error rejecting operator: ' + error.message, 'danger');
        } finally {
            // Hide the confirmation modal
            confirmationModal.hide();
        }
    });
    
    // Show the confirmation modal
    confirmationModal.show();
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
        // Show confirmation modal
        const logoutModal = new bootstrap.Modal(document.getElementById('logoutConfirmationModal'));
        logoutModal.show();
        
        // Get the confirm button
        const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
        
        // Remove any existing event listeners to prevent multiple calls
        const newConfirmBtn = confirmLogoutBtn.cloneNode(true);
        confirmLogoutBtn.parentNode.replaceChild(newConfirmBtn, confirmLogoutBtn);
        
        // Add event listener to the confirm button
        newConfirmBtn.addEventListener('click', async function() {
            // Hide the modal
            logoutModal.hide();
            
            // Perform the actual logout
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
            window.location.href = '../index.html';
        });
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

function formatDateTimeForInput(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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