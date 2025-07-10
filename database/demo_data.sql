-- demo_data.sql for E-Terminus
-- Clear existing data safely (preserves table structure)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE reviews;
TRUNCATE TABLE payments;
TRUNCATE TABLE tickets;
TRUNCATE TABLE bookings;
TRUNCATE TABLE schedules;
TRUNCATE TABLE stops;
TRUNCATE TABLE routes;
TRUNCATE TABLE buses;
TRUNCATE TABLE operators;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- ======================
-- 1. USER ACCOUNTS
-- ======================
-- Password for all demo accounts: "password" (bcrypt hashed)
INSERT INTO users (username, email, password_hash, user_type, phone) VALUES
-- System Admin
('admin', 'admin@eterminus.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '260977123456'),

-- Bus Operators
('mazhandu', 'contact@mazhandu.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'operator', '260977111111'),
('juldan', 'info@juldan.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'operator', '260977222222'),
('shalom', 'bookings@shalom.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'operator', '260977333333'),

-- Passengers
('john_doe', 'john@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'passenger', '260977444444'),
('mary_smith', 'mary@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'passenger', '260977555555'),
('chanda_b', 'chanda@unza.zm', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'passenger', '260977666666');

-- ======================
-- 2. BUS OPERATORS
-- ======================
INSERT INTO operators (user_id, company_name, license_number, contact_person, status) VALUES
((SELECT user_id FROM users WHERE username = 'mazhandu'), 'Mazhandu Family Bus Services', 'MFBS2023', 'Mr. Banda', 'active'),
((SELECT user_id FROM users WHERE username = 'juldan'), 'Juldan Bus Services', 'JBS2023', 'Mrs. Phiri', 'active'),
((SELECT user_id FROM users WHERE username = 'shalom'), 'Shalom Bus Company', 'SBC2023', 'Mr. Lungu', 'active');

-- ======================
-- 3. BUS FLEET
-- ======================
INSERT INTO buses (operator_id, plate_number, capacity, amenities, status) VALUES
-- Mazhandu buses
(1, 'ABC1234', 45, 'AC, WiFi, Charging Ports', 'active'),
(1, 'DEF5678', 35, 'AC, Reclining Seats', 'active'),

-- Juldan buses
(2, 'GHI9012', 50, 'AC, Entertainment System', 'active'),
(2, 'JKL3456', 30, 'Luxury Seats, Refreshments', 'active'),

-- Shalom buses
(3, 'MNO7890', 40, 'AC, Toilet', 'active'),
(3, 'PQR1234', 45, 'Standard Seating', 'maintenance');

-- ======================
-- 4. TRANSPORT ROUTES
-- ======================
INSERT INTO routes (origin, destination, distance_km, estimated_duration_min) VALUES
('Lusaka', 'Livingstone', 471.5, 420),  -- ~7 hours
('Lusaka', 'Ndola', 320.0, 300),       -- ~5 hours
('Lusaka', 'Kitwe', 290.0, 270),
('Lusaka', 'Chipata', 553.0, 480),
('Ndola', 'Livingstone', 580.0, 540);

-- ======================
-- 5. ROUTE STOPS
-- ======================
-- Lusaka-Livingstone stops
INSERT INTO stops (route_id, stop_name, sequence_order) VALUES
(1, 'Kafue', 1),
(1, 'Mazabuka', 2),
(1, 'Monze', 3),
(1, 'Choma', 4),
(1, 'Kalomo', 5);

-- Lusaka-Ndola stops
INSERT INTO stops (route_id, stop_name, sequence_order) VALUES
(2, 'Kapiri Mposhi', 1),
(2, 'Kabwe', 2),
(2, 'Ndola', 3);

-- ======================
-- 6. SCHEDULED TRIPS
-- ======================
-- Generate schedules for next 7 days
INSERT INTO schedules (bus_id, route_id, departure_time, arrival_time, price, available_seats, status) VALUES
-- Today's trips
(1, 1, DATE_ADD(CURDATE(), INTERVAL '06:00' HOUR_MINUTE), DATE_ADD(CURDATE(), INTERVAL '13:00' HOUR_MINUTE), 350.00, 45, 'scheduled'),
(3, 2, DATE_ADD(CURDATE(), INTERVAL '07:30' HOUR_MINUTE), DATE_ADD(CURDATE(), INTERVAL '12:30' HOUR_MINUTE), 250.00, 50, 'scheduled'),

-- Tomorrow's trips
(2, 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL '08:00' HOUR_MINUTE, DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL '15:00' HOUR_MINUTE, 400.00, 35, 'scheduled'),
(4, 3, DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL '09:00' HOUR_MINUTE, DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL '13:30' HOUR_MINUTE, 300.00, 30, 'scheduled'),

-- Day after tomorrow
(5, 4, DATE_ADD(CURDATE(), INTERVAL 2 DAY) + INTERVAL '05:00' HOUR_MINUTE, DATE_ADD(CURDATE(), INTERVAL 2 DAY) + INTERVAL '13:00' HOUR_MINUTE, 450.00, 40, 'scheduled'),

-- Completed trip (for testing history)
(6, 2, DATE_SUB(CURDATE(), INTERVAL 1 DAY) + INTERVAL '10:00' HOUR_MINUTE, DATE_SUB(CURDATE(), INTERVAL 1 DAY) + INTERVAL '15:00' HOUR_MINUTE, 250.00, 0, 'completed');

-- ======================
-- 7. BOOKINGS & TICKETS
-- ======================
INSERT INTO bookings (user_id, schedule_id, seat_number, booking_status, booking_date) VALUES
-- Active bookings
((SELECT user_id FROM users WHERE username = 'john_doe'), 1, 'A1', 'confirmed', NOW()),
((SELECT user_id FROM users WHERE username = 'mary_smith'), 1, 'A2', 'confirmed', NOW()),
((SELECT user_id FROM users WHERE username = 'chanda_b'), 2, 'B3', 'confirmed', NOW()),

-- Cancelled booking
((SELECT user_id FROM users WHERE username = 'john_doe'), 3, 'C4', 'cancelled', DATE_SUB(NOW(), INTERVAL 1 DAY));

-- Payments for bookings (UPDATED to match schema ENUM values)
INSERT INTO payments (booking_id, amount, payment_method, transaction_id, status, payment_date) VALUES
(1, 350.00, 'mobile_money', 'MM_123456789', 'success', NOW()),
(2, 350.00, 'card', 'CARD_987654321', 'success', NOW()),
(3, 250.00, 'mobile_money', 'MM_555555555', 'success', NOW()),
(4, 400.00, 'mobile_money', 'MM_111222333', 'failed', DATE_SUB(NOW(), INTERVAL 1 DAY));

-- Generated tickets
INSERT INTO tickets (booking_id, qr_code, is_used, issue_date) VALUES
(1, 'ticket_john_doe_1', 0, NOW()),
(2, 'ticket_mary_smith_1', 0, NOW()),
(3, 'ticket_chanda_b_1', 1, NOW());

-- ======================
-- 8. CUSTOMER REVIEWS
-- ======================
INSERT INTO reviews (user_id, bus_id, rating, comment, review_date) VALUES
((SELECT user_id FROM users WHERE username = 'chanda_b'), 6, 4, 'Comfortable ride but delayed by 30 mins', DATE_SUB(NOW(), INTERVAL 2 DAY)),
((SELECT user_id FROM users WHERE username = 'john_doe'), 1, 5, 'Excellent service! WiFi worked perfectly', DATE_SUB(NOW(), INTERVAL 1 WEEK)),
((SELECT user_id FROM users WHERE username = 'mary_smith'), 3, 3, 'Average experience. Bus was clean but AC wasn''t cold', DATE_SUB(NOW(), INTERVAL 3 DAY));

-- ======================
-- DATA VERIFICATION QUERY
-- ======================
-- Uncomment to run after import
/*
SELECT 'Users' AS table_name, COUNT(*) AS count FROM users
UNION SELECT 'Operators', COUNT(*) FROM operators
UNION SELECT 'Buses', COUNT(*) FROM buses
UNION SELECT 'Routes', COUNT(*) FROM routes
UNION SELECT 'Stops', COUNT(*) FROM stops
UNION SELECT 'Schedules', COUNT(*) FROM schedules
UNION SELECT 'Bookings', COUNT(*) FROM bookings
UNION SELECT 'Payments', COUNT(*) FROM payments
UNION SELECT 'Tickets', COUNT(*) FROM tickets
UNION SELECT 'Reviews', COUNT(*) FROM reviews;
*/