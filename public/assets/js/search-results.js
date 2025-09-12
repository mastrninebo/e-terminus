$(document).ready(function() {
            // Define pendingScheduleId variable
            let pendingScheduleId = null;
            
            // Get search parameters from URL
            const urlParams = new URLSearchParams(window.location.search);
            const origin = urlParams.get('origin');
            const destination = urlParams.get('destination');
            const date = urlParams.get('date');
            
            console.log('Search parameters:', { origin, destination, date });
            
            // Load search results
            loadSearchResults(origin, destination, date);
            
            // Handle book now button click
            $(document).on('click', '.btn-book', function() {
                const scheduleId = $(this).data('schedule-id');
                
                // Check if user is logged in
                const currentUser = localStorage.getItem('currentUser');
                
                if (!currentUser) {
                    // Store the schedule ID for later use after login
                    pendingScheduleId = scheduleId;
                    
                    // Redirect to login page with return URL
                    const currentUrl = encodeURIComponent(window.location.href);
                    window.location.href = `login.html?redirect=${currentUrl}`;
                } else {
                    // Redirect to booking page (go up one level from public/ to root)
                    window.location.href = `../booking.html?schedule_id=${scheduleId}`;
                }
            });
        });
        
        function loadSearchResults(origin, destination, date) {
            console.log('Loading search results for:', origin, destination, date);
            
            // Use BASE_URL from main-script.js
            // Fixed: Construct URL in one line to avoid reassigning const
            const apiUrl = `${BASE_URL}/api/search_routes.php?origin=${origin}&destination=${destination}${date ? `&date=${date}` : ''}`;
            
            console.log('API URL:', apiUrl);
            
            $.ajax({
                url: apiUrl,
                method: 'GET',
                dataType: 'json',
                success: function(schedules) {
                    console.log('Search results:', schedules);
                    const resultsContainer = $('#searchResults');
                    
                    if (schedules && schedules.length > 0) {
                        let resultsHtml = `
                            <div class="alert alert-info">
                                Showing ${schedules.length} results for buses from ${origin} to ${destination}
                                ${date ? ` on ${new Date(date).toLocaleDateString()}` : ''}
                            </div>
                        `;
                        
                        schedules.forEach(function(schedule) {
                            // Use let instead of const for variables that might be reassigned
                            let departureTime = new Date(schedule.departure_time);
                            let arrivalTime = new Date(schedule.arrival_time);
                            let operatorImage = `../images/operator-${schedule.operator_id}.jpg`;
                            let busType = schedule.bus_type || 'Standard Bus';
                            let originTerminal = schedule.origin_terminal || 'Main Terminal';
                            
                            // Calculate duration in hours
                            let hours = Math.floor(schedule.duration_minutes / 60);
                            let minutes = schedule.duration_minutes % 60;
                            let duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                            
                            resultsHtml += `
                                <div class="result-card">
                                    <div class="result-header">
                                        <div class="row align-items-center">
                                            <div class="col-md-6">
                                                <h5 class="mb-0">${schedule.origin} → ${schedule.destination}</h5>
                                                <small>${schedule.company_name}</small>
                                            </div>
                                            <div class="col-md-6 text-end">
                                                <h4 class="mb-0">ZMW ${schedule.price}</h4>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="card-body">
                                        <div class="row">
                                            <div class="col-md-2">
                                                <div class="operator-image-container mb-3">
                                                    <img src="${operatorImage}" alt="${schedule.company_name}" class="img-fluid rounded" 
                                                         onerror="this.onerror=null; this.src='https://via.placeholder.com/120x80?text=Bus+Image'">
                                                </div>
                                            </div>
                                            <div class="col-md-10">
                                                <div class="row">
                                                    <div class="col-md-3">
                                                        <p class="mb-1"><strong>Bus Type:</strong> ${busType}</p>
                                                        <p class="mb-1"><strong>Available:</strong> ${schedule.available_seats} seats</p>
                                                    </div>
                                                    <div class="col-md-3">
                                                        <p class="mb-1"><strong>Departure:</strong></p>
                                                        <h6>${departureTime.toLocaleDateString()}</h6>
                                                        <p>${departureTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                    </div>
                                                    <div class="col-md-3">
                                                        <p class="mb-1"><strong>Arrival:</strong></p>
                                                        <h6>${arrivalTime.toLocaleDateString()}</h6>
                                                        <p>${arrivalTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                    </div>
                                                    <div class="col-md-3 d-flex flex-column justify-content-between">
                                                        <div>
                                                            <p class="mb-1"><strong>Duration:</strong> ${duration}</p>
                                                            <p class="mb-1"><strong>Terminal:</strong> ${originTerminal}</p>
                                                        </div>
                                                        <button class="btn btn-book w-100" data-schedule-id="${schedule.schedule_id}">
                                                            Book Now
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        });
                        
                        resultsContainer.html(resultsHtml);
                    } else {
                        resultsContainer.html(`
                            <div class="alert alert-warning text-center">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                No buses found for ${origin} to ${destination}
                                ${date ? ` on ${new Date(date).toLocaleDateString()}` : ''}
                            </div>
                        `);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Search error:', error);
                    console.log('Response text:', xhr.responseText);
                    $('#searchResults').html(`
                        <div class="alert alert-danger text-center">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            Error loading search results. Please try again.
                        </div>
                    `);
                }
            });
        }