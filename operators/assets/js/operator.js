const BASE_URL = window.location.origin + '/e-terminus';
let currentOperator = null;

// API Paths - using absolute paths
const API_PATHS = {
    login: `${BASE_URL}/api/auth/login.php`,
    getStats: `${BASE_URL}/api/operator/get_stats.php`,
    getBuses: `${BASE_URL}/api/operator/get_buses.php`,
    getSchedules: `${BASE_URL}/api/operator/get_schedules.php`,
    getBookings: `${BASE_URL}/api/operator/get_bookings.php`,
    getReviews: `${BASE_URL}/api/operator/get_reviews.php`,
    createBus: `${BASE_URL}/api/operator/create_bus.php`,
    createSchedule: `${BASE_URL}/api/operator/create_schedule.php`,
    updateProfile: `${BASE_URL}/api/operator/update_profile.php`,
    changePassword: `${BASE_URL}/api/operator/change_password.php`
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    // Create notification container if it doesn't exist
    if (!document.getElementById('notificationContainer')) {
        const container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'notification-container';
        document.body.appendChild(container);
        console.log('Notification container created');
    }
    
    // Check if we're on login page or dashboard
    if (document.getElementById('operatorLoginForm')) {
        console.log('Setting up login form');
        setupLoginForm();
    } else if (document.getElementById('sidebar')) {
        console.log('Setting up dashboard');
        checkOperatorAuthStatus();
        setupDashboardEventListeners();
    }
});

// Login Form Setup
function setupLoginForm() {
    const loginForm = document.getElementById('operatorLoginForm');
    const togglePasswordBtn = document.querySelector('.toggle-password');
    
    // Password toggle
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            
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
    }
    
    // Form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form values
            const operatorCodeInput = loginForm.querySelector('input[placeholder="OPR-XXXXXX"]');
            const passwordInput = loginForm.querySelector('input[type="password"]');
            const rememberInput = document.getElementById('rememberOperator');
            
            if (!operatorCodeInput || !passwordInput) {
                showNotification('Please fill in all required fields', 'danger');
                return;
            }
            
            const operatorCode = operatorCodeInput.value;
            const password = passwordInput.value;
            const remember = rememberInput ? rememberInput.checked : false;
            
            try {
                // Show loading state
                const loginButton = document.getElementById('loginButton');
                const spinner = loginButton.querySelector('.loading-spinner');
                loginButton.disabled = true;
                spinner.style.display = 'inline-block';
                
                console.log('Current URL:', window.location.href);
                console.log('BASE_URL:', BASE_URL);
                console.log('Attempting login to:', API_PATHS.login);
                
                // Prepare request data
                const requestData = { 
                    operator_code: operatorCode, 
                    password: password,
                    remember: remember
                };
                
                console.log('Request data:', requestData);
                
                const response = await fetch(API_PATHS.login, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });
                
                console.log('Login response status:', response.status);
                console.log('Login response status text:', response.statusText);
                console.log('Login response URL:', response.url);
                console.log('Login response headers:', [...response.headers.entries()]);
                
                // Try to get response text even for errors
                let responseText = '';
                try {
                    responseText = await response.text();
                    console.log('Login response text:', responseText);
                } catch (e) {
                    console.log('Could not read response text:', e);
                }
                
                // Reset loading state
                loginButton.disabled = false;
                spinner.style.display = 'none';
                
                if (response.ok) {
                    let data;
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) {
                        console.error('Failed to parse JSON response:', e);
                        showNotification('Invalid server response format', 'danger');
                        return;
                    }
                    
                    console.log('Login response data:', data);
                    
                    if (data.success) {
                        // Verify this is an operator account
                        if (data.user.user_type !== 'operator') {
                            showNotification('Unauthorized access. This portal is for operators only.', 'danger');
                            return;
                        }
                        
                        // Check if operator account is active
                        if (data.operator && data.operator.status !== 'active') {
                            showNotification('Your operator account is suspended. Please contact support.', 'danger');
                            return;
                        }
                        
                        // Store token and user data
                        localStorage.setItem('auth_token', data.token);
                        localStorage.setItem('operator_data', JSON.stringify(data.user));
                        if (data.operator) {
                            localStorage.setItem('operator_details', JSON.stringify(data.operator));
                        }
                        
                        // Redirect to dashboard
                        window.location.href = 'dashboard.html';
                    } else {
                        showNotification(data.error || 'Login failed', 'danger');
                    }
                } else {
                    // Handle error responses
                    let errorMessage = 'Login failed';
                    
                    if (response.status === 403) {
                        // Try to extract error message from response
                        if (responseText) {
                            try {
                                const errorData = JSON.parse(responseText);
                                if (errorData.error) {
                                    errorMessage = errorData.error;
                                    
                                    // Special handling for verification required
                                    if (errorData.verification_required) {
                                        showNotification(errorMessage, 'warning');
                                        return;
                                    }
                                }
                            } catch (e) {
                                // Ignore JSON parsing errors for error responses
                            }
                        }
                        
                        if (errorMessage === 'Login failed') {
                            errorMessage = 'Access forbidden. Please check your credentials.';
                        }
                    } else if (response.status === 404) {
                        errorMessage = 'Login endpoint not found.';
                    } else if (response.status === 500) {
                        errorMessage = 'Server error. Please try again later.';
                    } else {
                        errorMessage = `Login failed with status ${response.status}: ${response.statusText}`;
                    }
                    
                    showNotification(errorMessage, 'danger');
                }
            } catch (error) {
                console.error('Login error:', error);
                showNotification('An error occurred during login: ' + error.message, 'danger');
                
                // Reset loading state
                const loginButton = document.getElementById('loginButton');
                const spinner = loginButton.querySelector('.loading-spinner');
                loginButton.disabled = false;
                spinner.style.display = 'none';
            }
        });
    }
}

// Check Operator Authentication
function checkOperatorAuthStatus() {
    console.log('Checking operator auth status...');
    
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('operator_data');
    const operatorDetails = localStorage.getItem('operator_details');
    
    console.log('Token exists:', !!token);
    console.log('User data exists:', !!userData);
    console.log('Operator details exist:', !!operatorDetails);
    
    if (!token || !userData) {
        console.log('Redirecting to login - missing token or user data');
        redirectToLogin();
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        console.log('User type:', user.user_type);
        
        if (user.user_type !== 'operator') {
            console.log('Redirecting to login - not an operator');
            redirectToLogin();
            return;
        }
        
        // Merge user and operator details
        currentOperator = { ...user };
        if (operatorDetails) {
            currentOperator = { ...currentOperator, ...JSON.parse(operatorDetails) };
        }
        console.log('Current operator data:', currentOperator);
        
        // Update UI
        updateUIForLoggedInOperator();
        console.log('UI updated successfully');
        
        // Load dashboard data
        loadDashboardData();
        console.log('Dashboard data loading initiated');
        
    } catch (error) {
        console.error('Error parsing user data:', error);
        redirectToLogin();
    }
}

// Redirect to login page
function redirectToLogin() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('operator_data');
    localStorage.removeItem('operator_details');
    window.location.href = 'login.html';
}

// Update UI for logged-in operator
function updateUIForLoggedInOperator() {
    console.log('Updating UI for logged-in operator');
    
    if (!currentOperator) {
        console.error('No current operator data for UI update');
        return;
    }
    
    // Log all elements we're trying to update
    console.log('DOM elements for update:');
    console.log('- Company name elements:', document.querySelectorAll('#operatorCompanyName').length);
    console.log('- Operator code elements:', document.querySelectorAll('#operatorCode').length);
    console.log('- Verification status elements:', document.querySelectorAll('#verificationStatus').length);
    console.log('- Contact elements:', document.querySelectorAll('#operatorContact').length);
    console.log('- Sidebar name element:', document.getElementById('sidebarOperatorName'));
    console.log('- Company name field:', document.getElementById('companyName'));
    console.log('- Operator code field:', document.getElementById('operatorCodeField'));
    console.log('- Contact field:', document.getElementById('contactPerson'));
    console.log('- Email field:', document.getElementById('emailAddress'));
    
    // Update company name
    const companyNameElements = document.querySelectorAll('#operatorCompanyName');
    console.log('Company name elements found:', companyNameElements.length);
    companyNameElements.forEach(element => {
        element.textContent = currentOperator.company_name || 'Operator Company';
    });
    
    // Update operator code
    const codeElements = document.querySelectorAll('#operatorCode');
    console.log('Operator code elements found:', codeElements.length);
    codeElements.forEach(element => {
        element.textContent = currentOperator.operator_code || 'N/A';
    });
    
    // Update verification status
    const statusElements = document.querySelectorAll('#verificationStatus');
    console.log('Verification status elements found:', statusElements.length);
    statusElements.forEach(element => {
        const status = currentOperator.verification_status || 'pending';
        element.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        
        // Add color coding
        if (status === 'verified') {
            element.className = 'text-success';
        } else if (status === 'rejected') {
            element.className = 'text-danger';
        } else {
            element.className = 'text-warning';
        }
    });
    
    // Update contact person
    const contactElements = document.querySelectorAll('#operatorContact');
    console.log('Contact elements found:', contactElements.length);
    contactElements.forEach(element => {
        element.textContent = currentOperator.contact_person || 'N/A';
    });
    
    // Update sidebar operator name
    const sidebarName = document.getElementById('sidebarOperatorName');
    console.log('Sidebar name element found:', !!sidebarName);
    if (sidebarName) {
        sidebarName.textContent = currentOperator.company_name || currentOperator.username || 'Operator';
    }
    
    // Update profile form fields
    const companyNameField = document.getElementById('companyName');
    if (companyNameField && currentOperator.company_name) {
        companyNameField.value = currentOperator.company_name;
    }
    
    const operatorCodeField = document.getElementById('operatorCodeField');
    if (operatorCodeField && currentOperator.operator_code) {
        operatorCodeField.value = currentOperator.operator_code;
        operatorCodeField.readOnly = true; // Make operator code read-only
    }
    
    const contactField = document.getElementById('contactPerson');
    if (contactField && currentOperator.contact_person) {
        contactField.value = currentOperator.contact_person;
    }
    
    const emailField = document.getElementById('emailAddress');
    if (emailField && currentOperator.email) {
        emailField.value = currentOperator.email;
    }
    
    console.log('UI update completed');
}

// Setup Dashboard Event Listeners
function setupDashboardEventListeners() {
    console.log('Setting up dashboard event listeners');
    
    const sidebar = document.getElementById('sidebar');
    const mobileToggle = document.getElementById('mobileMenuToggle');
    
    // Toggle sidebar on mobile
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            sidebar.classList.toggle('show');
        });
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
            sidebar && 
            !sidebar.contains(event.target) && 
            event.target !== mobileToggle && 
            !mobileToggle.contains(event.target)) {
            sidebar.classList.remove('show');
        }
    });
    
    // Handle tab switching to load data when needed
    document.querySelectorAll('a[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(e) {
            const target = e.target.getAttribute('href');
            
            if (target === '#buses') {
                loadBusesData();
            } else if (target === '#schedules') {
                loadSchedulesData();
            } else if (target === '#bookings') {
                loadBookingsData();
            } else if (target === '#reviews') {
                loadReviewsData();
            }
        });
    });
    
    // Add bus button
    const addBusBtn = document.getElementById('saveBusBtn');
    if (addBusBtn) {
        addBusBtn.addEventListener('click', saveBus);
    }
    
    // Add schedule button
    const addScheduleBtn = document.getElementById('saveScheduleBtn');
    if (addScheduleBtn) {
        addScheduleBtn.addEventListener('click', saveSchedule);
    }
    
    // Profile form
    const profileForm = document.getElementById('companyInfoForm');
    if (profileForm) {
        profileForm.addEventListener('submit', updateProfile);
    }
    
    // Password change form
    const passwordForm = document.getElementById('passwordChangeForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', changePassword);
    }
    
    // Logout buttons
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    const desktopLogoutBtn = document.getElementById('desktopLogoutBtn');
    
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', logout);
    if (desktopLogoutBtn) desktopLogoutBtn.addEventListener('click', logout);
    
    console.log('Dashboard event listeners setup completed');
}

// Load Dashboard Data
async function loadDashboardData() {
    console.log('Loading dashboard data...');
    
    if (!currentOperator) {
        console.error('No current operator data available');
        return;
    }
    
    try {
        await loadOperatorStats();
        console.log('Dashboard data loaded successfully');
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'danger');
    }
}

// API call helper function
async function apiCall(url, options = {}) {
    const token = localStorage.getItem('auth_token');
    
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        console.log('Making API call to:', url);
        const response = await fetch(url, mergedOptions);
        console.log('API response status:', response.status);
        
        if (response.status === 401) {
            // Token expired or invalid
            showNotification('Session expired. Please login again.', 'warning');
            redirectToLogin();
            return null;
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call error:', error);
        showNotification(error.message || 'An error occurred', 'danger');
        throw error;
    }
}

// Load Operator Statistics
async function loadOperatorStats() {
    console.log('Loading operator stats...');
    
    try {
        const stats = await apiCall(API_PATHS.getStats);
        console.log('Stats data:', stats);
        
        // Update statistics cards with real data
        const statCards = document.querySelectorAll('#dashboard .stat-card');
        console.log('Found stat cards:', statCards.length);
        
        if (statCards.length >= 1) {
            const busesElement = statCards[0].querySelector('.card-text');
            if (busesElement) {
                busesElement.textContent = stats.total_buses || '0';
                console.log('Updated buses element');
            } else {
                console.warn('Buses element not found in first card');
            }
        }
        
        if (statCards.length >= 2) {
            const tripsElement = statCards[1].querySelector('.card-text');
            if (tripsElement) {
                tripsElement.textContent = stats.today_trips || '0';
                console.log('Updated trips element');
            } else {
                console.warn('Trips element not found in second card');
            }
        }
        
        if (statCards.length >= 3) {
            const ratingElement = statCards[2].querySelector('.card-text');
            if (ratingElement) {
                ratingElement.textContent = (stats.average_rating || '0') + '/5';
                console.log('Updated rating element');
            } else {
                console.warn('Rating element not found in third card');
            }
        }
        
    } catch (error) {
        console.error('Error loading operator stats:', error);
        showNotification('Error loading statistics', 'danger');
    }
}

// Load Buses Data
async function loadBusesData() {
    console.log('Loading buses data...');
    
    try {
        const buses = await apiCall(API_PATHS.getBuses);
        console.log('Buses data:', buses);
        
        const busesTable = document.querySelector('#buses tbody');
        if (busesTable) {
            if (buses.length > 0) {
                let busesHtml = '';
                buses.forEach(bus => {
                    busesHtml += `
                        <tr>
                            <td>${bus.bus_id}</td>
                            <td>${bus.plate_number}</td>
                            <td>${bus.capacity} seats</td>
                            <td><span class="badge bg-${getBusStatusClass(bus.status)}">${bus.status}</span></td>
                            <td>
                                <button class="btn btn-sm btn-info action-btn edit-bus" data-id="${bus.bus_id}" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger action-btn delete-bus" data-id="${bus.bus_id}" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                busesTable.innerHTML = busesHtml;
                
                // Add event listeners to edit/delete buttons
                document.querySelectorAll('.edit-bus').forEach(button => {
                    button.addEventListener('click', function() {
                        const busId = this.getAttribute('data-id');
                        editBus(busId);
                    });
                });
                
                document.querySelectorAll('.delete-bus').forEach(button => {
                    button.addEventListener('click', function() {
                        const busId = this.getAttribute('data-id');
                        deleteBus(busId);
                    });
                });
            } else {
                busesTable.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-muted">No buses found</td>
                    </tr>
                `;
            }
        }
        
    } catch (error) {
        console.error('Error loading buses data:', error);
        showNotification('Error loading buses data', 'danger');
    }
}

// Load Schedules Data
async function loadSchedulesData() {
    console.log('Loading schedules data...');
    
    try {
        const schedules = await apiCall(API_PATHS.getSchedules);
        console.log('Schedules data:', schedules);
        
        const schedulesTable = document.querySelector('#schedules tbody');
        if (schedulesTable) {
            if (schedules.length > 0) {
                let schedulesHtml = '';
                schedules.forEach(schedule => {
                    schedulesHtml += `
                        <tr>
                            <td>${schedule.schedule_id}</td>
                            <td>${schedule.origin} to ${schedule.destination}</td>
                            <td>${schedule.bus_plate_number}</td>
                            <td>${formatDateTime(schedule.departure_time)}</td>
                            <td>${formatDateTime(schedule.arrival_time)}</td>
                            <td>${schedule.price}</td>
                            <td><span class="badge bg-${getScheduleStatusClass(schedule.status)}">${schedule.status}</span></td>
                            <td>
                                <button class="btn btn-sm btn-info action-btn edit-schedule" data-id="${schedule.schedule_id}" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-danger action-btn delete-schedule" data-id="${schedule.schedule_id}" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                schedulesTable.innerHTML = schedulesHtml;
                
                // Add event listeners to edit/delete buttons
                document.querySelectorAll('.edit-schedule').forEach(button => {
                    button.addEventListener('click', function() {
                        const scheduleId = this.getAttribute('data-id');
                        editSchedule(scheduleId);
                    });
                });
                
                document.querySelectorAll('.delete-schedule').forEach(button => {
                    button.addEventListener('click', function() {
                        const scheduleId = this.getAttribute('data-id');
                        deleteSchedule(scheduleId);
                    });
                });
            } else {
                schedulesTable.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-muted">No schedules found</td>
                    </tr>
                `;
            }
        }
        
    } catch (error) {
        console.error('Error loading schedules data:', error);
        showNotification('Error loading schedules data', 'danger');
    }
}

// Load Bookings Data
async function loadBookingsData() {
    console.log('Loading bookings data...');
    
    try {
        const bookings = await apiCall(API_PATHS.getBookings);
        console.log('Bookings data:', bookings);
        
        const bookingsTable = document.querySelector('#bookings tbody');
        if (bookingsTable) {
            if (bookings.length > 0) {
                let bookingsHtml = '';
                bookings.forEach(booking => {
                    bookingsHtml += `
                        <tr>
                            <td>#${booking.booking_id}</td>
                            <td>${booking.username}</td>
                            <td>${booking.origin} to ${booking.destination}<br><small>${formatDateTime(booking.departure_time)}</small></td>
                            <td>${booking.amount} ZMW</td>
                            <td><span class="badge bg-${getStatusClass(booking.booking_status)}">${booking.booking_status}</span></td>
                            <td><span class="badge bg-${getStatusClass(booking.payment_status)}">${booking.payment_status}</span></td>
                            <td>
                                <button class="btn btn-sm btn-info action-btn view-booking" data-id="${booking.booking_id}" title="View">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-secondary action-btn print-ticket" data-id="${booking.booking_id}" title="Print">
                                    <i class="fas fa-print"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                bookingsTable.innerHTML = bookingsHtml;
                
                // Add event listeners to view/print buttons
                document.querySelectorAll('.view-booking').forEach(button => {
                    button.addEventListener('click', function() {
                        const bookingId = this.getAttribute('data-id');
                        viewBooking(bookingId);
                    });
                });
                
                document.querySelectorAll('.print-ticket').forEach(button => {
                    button.addEventListener('click', function() {
                        const bookingId = this.getAttribute('data-id');
                        printTicket(bookingId);
                    });
                });
            } else {
                bookingsTable.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted">No bookings found</td>
                    </tr>
                `;
            }
        }
        
    } catch (error) {
        console.error('Error loading bookings data:', error);
        showNotification('Error loading bookings data', 'danger');
    }
}

// Load Reviews Data
async function loadReviewsData() {
    console.log('Loading reviews data...');
    
    try {
        const reviews = await apiCall(API_PATHS.getReviews);
        console.log('Reviews data:', reviews);
        
        const reviewsContainer = document.querySelector('#reviews .col-md-8 .card-body');
        if (reviewsContainer) {
            if (reviews.length > 0) {
                let reviewsHtml = '';
                let totalRating = 0;
                let approvedCount = 0;
                
                reviews.forEach(review => {
                    if (review.is_approved) {
                        totalRating += review.rating;
                        approvedCount++;
                    }
                    
                    reviewsHtml += `
                        <div class="d-flex mb-4">
                            <img src="https://ui-avatars.com/api/?name=${review.username}&background=random" class="rounded-circle me-3" alt="User" width="50" height="50">
                            <div>
                                <h5>${review.username}</h5>
                                <div class="text-warning">
                                    ${generateStarRating(review.rating)}
                                    <span class="ms-2">${review.rating}</span>
                                </div>
                                <p class="mb-0">${review.comment || 'No comment provided'}</p>
                                <small class="text-muted">${formatDateTime(review.review_date)}</small>
                            </div>
                        </div>
                    `;
                });
                
                reviewsContainer.innerHTML = reviewsHtml;
                
                // Update average rating
                const avgRating = approvedCount > 0 ? totalRating / approvedCount : 0;
                const ratingElement = document.querySelector('#reviews .display-4');
                if (ratingElement) ratingElement.textContent = avgRating.toFixed(1);
            } else {
                reviewsContainer.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <p>No reviews found</p>
                    </div>
                `;
                
                // Update average rating
                const ratingElement = document.querySelector('#reviews .display-4');
                if (ratingElement) ratingElement.textContent = '0.0';
            }
        }
        
    } catch (error) {
        console.error('Error loading reviews data:', error);
        showNotification('Error loading reviews data', 'danger');
    }
}

// Save Bus
async function saveBus() {
    try {
        // Get form values
        const plateNumber = document.getElementById('busPlateNumber').value;
        const capacity = document.getElementById('busCapacity').value;
        const status = document.getElementById('busStatus').value;
        
        if (!plateNumber || !capacity) {
            showNotification('Please fill in all required fields', 'danger');
            return;
        }
        
        const busData = {
            plateNumber,
            capacity: parseInt(capacity),
            status
        };
        
        console.log('Saving bus:', busData);
        
        const response = await apiCall(API_PATHS.createBus, {
            method: 'POST',
            body: JSON.stringify(busData)
        });
        
        console.log('Save bus response:', response);
        
        if (response.success) {
            showNotification('Bus added successfully', 'success');
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('addBusModal'));
            modal.hide();
            document.getElementById('addBusForm').reset();
            
            // Reload buses data
            loadBusesData();
        } else {
            showNotification(response.error || 'Error adding bus', 'danger');
        }
    } catch (error) {
        console.error('Error saving bus:', error);
        showNotification('Error adding bus', 'danger');
    }
}

// Save Schedule
async function saveSchedule() {
    try {
        // Get form values
        const routeSelect = document.getElementById('scheduleRoute');
        const busSelect = document.getElementById('scheduleBus');
        const departureTime = document.getElementById('departureTime').value;
        const arrivalTime = document.getElementById('arrivalTime').value;
        const price = document.getElementById('ticketPrice').value;
        const availableSeats = document.getElementById('availableSeats').value;
        
        if (!routeSelect || !busSelect || !departureTime || !arrivalTime || !price || !availableSeats) {
            showNotification('Please fill in all required fields', 'danger');
            return;
        }
        
        const scheduleData = {
            routeId: parseInt(routeSelect.value),
            busId: parseInt(busSelect.value),
            departureTime,
            arrivalTime,
            price: parseFloat(price),
            availableSeats: parseInt(availableSeats)
        };
        
        console.log('Saving schedule:', scheduleData);
        
        const response = await apiCall(API_PATHS.createSchedule, {
            method: 'POST',
            body: JSON.stringify(scheduleData)
        });
        
        console.log('Save schedule response:', response);
        
        if (response.success) {
            showNotification('Schedule added successfully', 'success');
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('addScheduleModal'));
            modal.hide();
            document.getElementById('addScheduleForm').reset();
            
            // Reload schedules data
            loadSchedulesData();
        } else {
            showNotification(response.error || 'Error adding schedule', 'danger');
        }
    } catch (error) {
        console.error('Error saving schedule:', error);
        showNotification('Error adding schedule', 'danger');
    }
}

// Update Profile
async function updateProfile(e) {
    e.preventDefault();
    
    try {
        // Get form values
        const companyName = document.getElementById('companyName').value;
        const contactPerson = document.getElementById('contactPerson').value;
        const phone = document.getElementById('phoneNumber').value;
        
        if (!companyName) {
            showNotification('Company name is required', 'danger');
            return;
        }
        
        const profileData = {
            companyName,
            contactPerson,
            phone
        };
        
        console.log('Updating profile:', profileData);
        
        const response = await apiCall(API_PATHS.updateProfile, {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
        
        console.log('Update profile response:', response);
        
        if (response.success) {
            showNotification('Profile updated successfully', 'success');
            
            // Update current operator data
            currentOperator.company_name = companyName;
            currentOperator.contact_person = contactPerson;
            currentOperator.phone = phone;
            
            // Update localStorage
            localStorage.setItem('operator_details', JSON.stringify({
                operator_id: currentOperator.operator_id,
                operator_code: currentOperator.operator_code,
                company_name: companyName,
                contact_person: contactPerson,
                phone: phone,
                status: currentOperator.status,
                verification_status: currentOperator.verification_status
            }));
            
            // Update UI
            updateUIForLoggedInOperator();
        } else {
            showNotification(response.error || 'Error updating profile', 'danger');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Error updating profile', 'danger');
    }
}

// Change Password
async function changePassword(e) {
    e.preventDefault();
    
    try {
        // Get form values
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            showNotification('Please fill in all password fields', 'danger');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showNotification('New passwords do not match', 'danger');
            return;
        }
        
        const passwordData = {
            currentPassword,
            newPassword
        };
        
        console.log('Changing password');
        
        const response = await apiCall(API_PATHS.changePassword, {
            method: 'POST',
            body: JSON.stringify(passwordData)
        });
        
        console.log('Change password response:', response);
        
        if (response.success) {
            showNotification('Password changed successfully', 'success');
            
            // Reset form
            document.getElementById('passwordChangeForm').reset();
        } else {
            showNotification(response.error || 'Error changing password', 'danger');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showNotification('Error changing password', 'danger');
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear localStorage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('operator_data');
        localStorage.removeItem('operator_details');
        
        // Redirect to login page
        window.location.href = 'login.html';
    }
}

// View Booking Details
function viewBooking(bookingId) {
    showNotification(`Viewing booking #${bookingId}`, 'info');
}

// Print Ticket
function printTicket(bookingId) {
    showNotification(`Printing ticket for booking #${bookingId}`, 'info');
}

// Edit Bus
function editBus(busId) {
    showNotification(`Editing bus #${busId}`, 'info');
}

// Delete Bus
function deleteBus(busId) {
    if (confirm('Are you sure you want to delete this bus?')) {
        showNotification(`Deleting bus #${busId}`, 'info');
    }
}

// Edit Schedule
function editSchedule(scheduleId) {
    showNotification(`Editing schedule #${scheduleId}`, 'info');
}

// Delete Schedule
function deleteSchedule(scheduleId) {
    if (confirm('Are you sure you want to delete this schedule?')) {
        showNotification(`Deleting schedule #${scheduleId}`, 'info');
    }
}

// Helper Functions
function formatDateTime(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function getStatusClass(status) {
    const statusClasses = {
        'confirmed': 'success',
        'pending': 'warning text-dark',
        'cancelled': 'danger',
        'completed': 'info',
        'success': 'success'
    };
    return statusClasses[status] || 'secondary';
}

function getBusStatusClass(status) {
    const statusClasses = {
        'active': 'success',
        'maintenance': 'warning text-dark',
        'retired': 'secondary'
    };
    return statusClasses[status] || 'secondary';
}

function getScheduleStatusClass(status) {
    const statusClasses = {
        'scheduled': 'primary',
        'pending': 'warning text-dark',
        'cancelled': 'danger',
        'completed': 'info'
    };
    return statusClasses[status] || 'secondary';
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
    // Find or create notification container
    let notificationContainer = document.getElementById('notificationContainer');
    
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.className = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '9999';
        notificationContainer.style.width = '300px';
        document.body.appendChild(notificationContainer);
    }
    
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    notificationContainer.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notificationContainer.contains(notification)) {
                notificationContainer.removeChild(notification);
            }
        }, 150);
    }, 5000);
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