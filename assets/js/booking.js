$(document).ready(function() {
            // Get schedule ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            const scheduleId = urlParams.get('schedule_id');
            
            if (!scheduleId) {
                showError('No schedule selected. Please search for buses first.');
                setTimeout(() => {
                    window.location.href = 'public/search-results.html';
                }, 2000);
                return;
            }
            
            // Initialize booking process
            initializeBooking(scheduleId);
        });
        
        // Global variables
        let currentSchedule = null;
        let selectedSeatsCount = 1;
        let bookingData = {
            schedule_id: null,
            number_of_seats: 1,
            payment_method: null,
            payment_details: {}
        };
        
        // Flag to prevent double execution
        let isProcessing = false;
        
        function initializeBooking(scheduleId) {
            // Check if user is logged in
            const currentUser = localStorage.getItem('currentUser');
            if (!currentUser) {
                showError('Please login to book a ticket.');
                setTimeout(() => {
                    window.location.href = `public/login.html?redirect=${encodeURIComponent(window.location.href)}`;
                }, 2000);
                return;
            }
            
            bookingData.schedule_id = scheduleId;
            
            // Load schedule details
            loadScheduleDetails(scheduleId);
            
            // Setup event listeners only once
            if (!window.bookingEventListenersSetup) {
                setupEventListeners();
                window.bookingEventListenersSetup = true;
            }
        }
        
        function loadScheduleDetails(scheduleId) {
            $.ajax({
                url: `${BASE_URL}/api/schedules/get_schedule.php`,
                method: 'GET',
                data: { schedule_id: scheduleId },
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        currentSchedule = response.schedule;
                        displayScheduleDetails(currentSchedule);
                        updateBookingSummary();
                        
                        // Set available seats
                        $('#availableSeats').text(currentSchedule.available_seats);
                        $('#pricePerSeat').text(`ZMW ${currentSchedule.price}`);
                        
                        // Set max seats
                        if (currentSchedule.available_seats === 0) {
                            $('#increaseSeats').prop('disabled', true);
                            $('#proceedToPayment').prop('disabled', true);
                            showError('No seats available for this schedule.');
                        }
                    } else {
                        showError(response.message || 'Failed to load schedule details.');
                    }
                },
                error: function(xhr) {
                    const errorMessage = xhr.responseJSON ? xhr.responseJSON.message : 'Error loading schedule details.';
                    showError(errorMessage);
                }
            });
        }
        
        function displayScheduleDetails(schedule) {
            const departureTime = new Date(schedule.departure_time);
            const arrivalTime = new Date(schedule.arrival_time);
            
            const hours = Math.floor(schedule.duration_minutes / 60);
            const minutes = schedule.duration_minutes % 60;
            const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            
            const detailsHtml = `
                <div class="row">
                    <div class="col-md-6">
                        <h5>${schedule.origin} → ${schedule.destination}</h5>
                        <p class="mb-1"><strong>Operator:</strong> ${schedule.company_name}</p>
                        <p class="mb-1"><strong>Departure:</strong> ${departureTime.toLocaleDateString()} at ${departureTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <div class="col-md-6">
                        <p class="mb-1"><strong>Arrival:</strong> ${arrivalTime.toLocaleDateString()} at ${arrivalTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        <p class="mb-1"><strong>Duration:</strong> ${duration}</p>
                        <p class="mb-1"><strong>Available Seats:</strong> ${schedule.available_seats}</p>
                        <p class="mb-1"><strong>Price per seat:</strong> ZMW ${schedule.price}</p>
                    </div>
                </div>
            `;
            
            $('#scheduleDetails').html(detailsHtml);
        }
        
        function setupEventListeners() {
            // Prevent multiple initializations
            if (window.bookingEventListenersSetup) {
                return;
            }
            
            // Remove all existing event handlers first
            $('#decreaseSeats, #increaseSeats, #proceedToPayment, #backToSeats, .payment-method, #paymentForm').off();
            
            // Seat counter - using flag to prevent double execution
            $('#decreaseSeats').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent double execution
                if (isProcessing) return;
                isProcessing = true;
                
                setTimeout(() => {
                    if (selectedSeatsCount > 1) {
                        selectedSeatsCount--;
                        $('#seatCount').text(selectedSeatsCount);
                        bookingData.number_of_seats = selectedSeatsCount;
                        updateBookingSummary();
                    }
                    isProcessing = false;
                }, 100);
            });
            
            $('#increaseSeats').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent double execution
                if (isProcessing) return;
                isProcessing = true;
                
                setTimeout(() => {
                    if (selectedSeatsCount < currentSchedule.available_seats) {
                        selectedSeatsCount++;
                        $('#seatCount').text(selectedSeatsCount);
                        bookingData.number_of_seats = selectedSeatsCount;
                        updateBookingSummary();
                    }
                    isProcessing = false;
                }, 100);
            });
            
            // Proceed to payment
            $('#proceedToPayment').on('click', function(e) {
                e.preventDefault();
                
                // Prevent double execution
                if (isProcessing) return;
                isProcessing = true;
                
                setTimeout(() => {
                    if (selectedSeatsCount === 0) {
                        showError('Please select at least one seat.');
                        isProcessing = false;
                        return;
                    }
                    
                    if (selectedSeatsCount > currentSchedule.available_seats) {
                        showError('Not enough seats available.');
                        isProcessing = false;
                        return;
                    }
                    
                    showSection('paymentSection');
                    updateStepIndicator(2);
                    isProcessing = false;
                }, 100);
            });
            
            // Back to seat selection
            $('#backToSeats').on('click', function(e) {
                e.preventDefault();
                
                // Prevent double execution
                if (isProcessing) return;
                isProcessing = true;
                
                setTimeout(() => {
                    showSection('seatSelectionSection');
                    updateStepIndicator(1);
                    isProcessing = false;
                }, 100);
            });
            
            // Payment method selection
            $('.payment-method').on('click', function(e) {
                e.preventDefault();
                
                // Prevent double execution
                if (isProcessing) return;
                isProcessing = true;
                
                setTimeout(() => {
                    $('.payment-method').removeClass('selected');
                    $(this).addClass('selected');
                    $(this).find('input[type="radio"]').prop('checked', true);
                    
                    const method = $(this).data('method');
                    bookingData.payment_method = method;
                    showPaymentMethodFields(method);
                    isProcessing = false;
                }, 100);
            });
            
            // Payment form submission
            $('#paymentForm').on('submit', function(e) {
                e.preventDefault();
                
                // Prevent double execution
                if (isProcessing) return;
                isProcessing = true;
                
                setTimeout(() => {
                    if (validatePaymentForm()) {
                        bookingData.payment_details = getPaymentDetails();
                        processBooking();
                    }
                    isProcessing = false;
                }, 100);
            });
            
            // Mark as set up
            window.bookingEventListenersSetup = true;
        }
        
        function showPaymentMethodFields(method) {
            const detailsContainer = $('#paymentMethodDetails');
            detailsContainer.empty();
            
            switch (method) {
                case 'mobile_money':
                    detailsContainer.html(`
                        <div class="mb-3">
                            <label class="form-label">Mobile Money Provider</label>
                            <select class="form-select" id="mobileProvider" required>
                                <option value="">Select provider</option>
                                <option value="airtel">Airtel Money</option>
                                <option value="mtn">MTN Mobile Money</option>
                                <option value="zamtel">Zamtel Kwacha</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Mobile Number</label>
                            <div class="input-group">
                                <span class="input-group-text">+260</span>
                                <input type="tel" class="form-control" id="mobileNumber" pattern="[0-9]{9}" required>
                            </div>
                            <small class="text-muted">Format: 97XXXXXXX (no spaces)</small>
                        </div>
                    `);
                    break;
                    
                case 'card':
                    detailsContainer.html(`
                        <div class="mb-3">
                            <label class="form-label">Card Number</label>
                            <input type="text" class="form-control" id="cardNumber" placeholder="1234 5678 9012 3456" maxlength="19" required>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Expiry Date</label>
                                <input type="text" class="form-control" id="cardExpiry" placeholder="MM/YY" maxlength="5" required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">CVV</label>
                                <input type="text" class="form-control" id="cardCvv" placeholder="123" maxlength="3" required>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Cardholder Name</label>
                            <input type="text" class="form-control" id="cardholderName" required>
                        </div>
                    `);
                    break;
                    
                /* case 'bank_transfer':
                    detailsContainer.html(`
                        <div class="alert alert-info">
                            <h6>Bank Transfer Details</h6>
                            <p class="mb-1"><strong>Bank:</strong> Zambia National Commercial Bank (ZANACO)</p>
                            <p class="mb-1"><strong>Account Name:</strong> E-Terminus Limited</p>
                            <p class="mb-0"><strong>Account Number:</strong> 1234567890</p>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Transaction Reference</label>
                            <input type="text" class="form-control" id="transactionRef" placeholder="Enter your transaction reference" required>
                        </div>
                    `);
                    break; */
            }
        }
        
        function validatePaymentForm() {
            const method = bookingData.payment_method;
            let isValid = true;
            
            if (!method) {
                showError('Please select a payment method.');
                return false;
            }
            
            switch (method) {
                case 'mobile_money':
                    if (!$('#mobileProvider').val()) {
                        $('#mobileProvider').addClass('is-invalid');
                        isValid = false;
                    } else {
                        $('#mobileProvider').removeClass('is-invalid');
                    }
                    
                    const mobileNumber = $('#mobileNumber').val();
                    if (!mobileNumber || mobileNumber.length !== 9) {
                        $('#mobileNumber').addClass('is-invalid');
                        isValid = false;
                    } else {
                        $('#mobileNumber').removeClass('is-invalid');
                    }
                    break;
                    
                case 'card':
                    const cardNumber = $('#cardNumber').val().replace(/\s/g, '');
                    if (!cardNumber || cardNumber.length < 13) {
                        $('#cardNumber').addClass('is-invalid');
                        isValid = false;
                    } else {
                        $('#cardNumber').removeClass('is-invalid');
                    }
                    
                    if (!$('#cardExpiry').val()) {
                        $('#cardExpiry').addClass('is-invalid');
                        isValid = false;
                    } else {
                        $('#cardExpiry').removeClass('is-invalid');
                    }
                    
                    if (!$('#cardCvv').val()) {
                        $('#cardCvv').addClass('is-invalid');
                        isValid = false;
                    } else {
                        $('#cardCvv').removeClass('is-invalid');
                    }
                    
                    if (!$('#cardholderName').val()) {
                        $('#cardholderName').addClass('is-invalid');
                        isValid = false;
                    } else {
                        $('#cardholderName').removeClass('is-invalid');
                    }
                    break;
                    
                /* case 'bank_transfer':
                    if (!$('#transactionRef').val()) {
                        $('#transactionRef').addClass('is-invalid');
                        isValid = false;
                    } else {
                        $('#transactionRef').removeClass('is-invalid');
                    }
                    break; */
            }
            
            return isValid;
        }
        
        function getPaymentDetails() {
            const method = bookingData.payment_method;
            let details = {};
            
            switch (method) {
                case 'mobile_money':
                    details = {
                        provider: $('#mobileProvider').val(),
                        mobile_number: $('#mobileNumber').val()
                    };
                    break;
                    
                case 'card':
                    details = {
                        card_number: $('#cardNumber').val().replace(/\s/g, ''),
                        expiry_date: $('#cardExpiry').val(),
                        cvv: $('#cardCvv').val(),
                        cardholder_name: $('#cardholderName').val()
                    };
                    break;
                    
                /* case 'bank_transfer':
                    details = {
                        transaction_reference: $('#transactionRef').val()
                    };
                    break; */
            }
            
            return details;
        }
        
        function processBooking() {
            showLoading(true);
            
            $.ajax({
                url: `${BASE_URL}/api/bookings/create_booking.php`,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(bookingData),
                success: function(response) {
                    if (response.success) {
                        showSuccess('Booking successful! Redirecting to confirmation...');
                        setTimeout(() => {
                            window.location.href = `public/booking-confirmation.html?booking_id=${response.booking_id}`;
                        }, 2000);
                    } else {
                        showError(response.message || 'Booking failed. Please try again.');
                        showLoading(false);
                    }
                },
                error: function(xhr) {
                    let errorMessage = 'Booking failed. Please try again.';
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMessage = xhr.responseJSON.message;
                    }
                    showError(errorMessage);
                    showLoading(false);
                }
            });
        }
        
        function updateBookingSummary() {
            const summaryContent = $('#bookingSummaryContent');
            
            if (!currentSchedule) {
                return;
            }
            
            const totalPrice = selectedSeatsCount * currentSchedule.price;
            
            const summaryHtml = `
                <div class="summary-row">
                    <span>Route:</span>
                    <span>${currentSchedule.origin} → ${currentSchedule.destination}</span>
                </div>
                <div class="summary-row">
                    <span>Date:</span>
                    <span>${new Date(currentSchedule.departure_time).toLocaleDateString()}</span>
                </div>
                <div class="summary-row">
                    <span>Time:</span>
                    <span>${new Date(currentSchedule.departure_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div class="summary-row">
                    <span>Operator:</span>
                    <span>${currentSchedule.company_name}</span>
                </div>
                <div class="summary-row">
                    <span>Number of Seats:</span>
                    <span>${selectedSeatsCount}</span>
                </div>
                <div class="summary-row">
                    <span>Price per Seat:</span>
                    <span>ZMW ${currentSchedule.price}</span>
                </div>
                <div class="summary-row">
                    <span>Total Amount:</span>
                    <span>ZMW ${totalPrice.toFixed(2)}</span>
                </div>
            `;
            
            summaryContent.html(summaryHtml);
        }
        
        function showSection(sectionId) {
            // Hide all sections
            $('#seatSelectionSection, #paymentSection').hide();
            
            // Show the selected section
            $(`#${sectionId}`).show();
        }
        
        function updateStepIndicator(step) {
            // Update step circles
            $('.step').removeClass('active completed');
            
            // Mark completed steps
            for (let i = 1; i < step; i++) {
                $(`.step:nth-child(${i})`).addClass('completed');
            }
            
            // Mark active step
            $(`.step:nth-child(${step})`).addClass('active');
            
            // Update progress bar
            const progressWidth = (step - 1) * 100;
            $('.step-progress').css('width', `${progressWidth}%`);
        }
        
        function showLoading(show) {
            if (show) {
                $('#loadingOverlay').removeClass('d-none');
            } else {
                $('#loadingOverlay').addClass('d-none');
            }
        }
        
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