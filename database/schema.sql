CREATE DATABASE IF NOT EXISTS e_terminus;
USE e_terminus;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- Store hashed passwords (bcrypt)
    phone VARCHAR(15),
    user_type ENUM('passenger', 'operator', 'admin') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE operators (
    operator_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,  -- Links to users table (for operator accounts)
    company_name VARCHAR(100) NOT NULL,
    license_number VARCHAR(50),
    contact_person VARCHAR(100),
    status ENUM('active', 'suspended') DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE buses (
    bus_id INT AUTO_INCREMENT PRIMARY KEY,
    operator_id INT NOT NULL,
    plate_number VARCHAR(20) UNIQUE NOT NULL,
    capacity INT NOT NULL,
    amenities TEXT,  -- e.g., "WiFi, AC, Charging Ports"
    status ENUM('active', 'maintenance', 'retired') DEFAULT 'active',
    FOREIGN KEY (operator_id) REFERENCES operators(operator_id)
);

CREATE TABLE routes (
    route_id INT AUTO_INCREMENT PRIMARY KEY,
    origin VARCHAR(100) NOT NULL,  -- e.g., "Lusaka"
    destination VARCHAR(100) NOT NULL,  -- e.g., "Livingstone"
    distance_km DECIMAL(10,2),
    estimated_duration_min INT
);

CREATE TABLE stops (
    stop_id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    stop_name VARCHAR(100) NOT NULL,  -- e.g., "Kafue", "Choma"
    sequence_order INT NOT NULL,  -- Order of stops (1, 2, 3...)
    FOREIGN KEY (route_id) REFERENCES routes(route_id)
);

CREATE TABLE schedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL,
    route_id INT NOT NULL,
    departure_time DATETIME NOT NULL,
    arrival_time DATETIME NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    available_seats INT NOT NULL,
    status ENUM('scheduled', 'cancelled', 'completed') DEFAULT 'scheduled',
    FOREIGN KEY (bus_id) REFERENCES buses(bus_id),
    FOREIGN KEY (route_id) REFERENCES routes(route_id)
);

CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    schedule_id INT NOT NULL,
    seat_number VARCHAR(10) NOT NULL,  -- e.g., "A1", "B3"
    booking_status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id)
);

CREATE TABLE tickets (
    ticket_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    qr_code VARCHAR(255) NOT NULL,  -- Store QR code path or data
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);

CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('mobile_money', 'card', 'cash') NOT NULL,
    transaction_id VARCHAR(100),  -- For Mobile Money/API references
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);

CREATE TABLE reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bus_id INT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (bus_id) REFERENCES buses(bus_id)
);