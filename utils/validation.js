// Input validation utilities

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate phone number (Nigerian and Kenyan formats)
function isValidPhone(phone) {
    if (!phone) return true; // Phone is optional

    const cleaned = phone.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses

    // Nigerian format: 080xxxxxxxx, 070xxxxxxxx, +234xxxxxxxxxx
    const nigerianRegex = /^(\+?234|0)[789]\d{9}$/;

    // Kenyan format: 07xxxxxxxx, 01xxxxxxxx, +254xxxxxxxxx
    const kenyanRegex = /^(\+?254|0)[17]\d{8}$/;

    // International format (10-15 digits)
    const internationalRegex = /^\+?\d{10,15}$/;

    // Simple format: at least 10 digits
    const simpleRegex = /^\d{10,15}$/;

    return nigerianRegex.test(cleaned) || kenyanRegex.test(cleaned) || internationalRegex.test(cleaned) || simpleRegex.test(cleaned);
}

// Validate ticket type
function isValidTicketType(type) {
    return ['regular', 'vip', 'bronze', 'platinum'].includes(type);
}

// Validate quantity
function isValidQuantity(quantity) {
    const qty = parseInt(quantity);
    return !isNaN(qty) && qty > 0 && qty <= 10;
}

// Validate price
function isValidPrice(price) {
    const p = parseFloat(price);
    return !isNaN(p) && p > 0;
}

// Sanitize string input
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
}

// Validate order creation data
function validateOrderData(data) {
    const errors = [];

    if (!data.email) {
        errors.push('Email is required');
    } else if (!isValidEmail(data.email)) {
        errors.push('Invalid email format');
    }

    if (!data.name) {
        errors.push('Name is required');
    } else if (data.name.length < 2) {
        errors.push('Name must be at least 2 characters');
    } else if (data.name.length > 100) {
        errors.push('Name must be less than 100 characters');
    }

    if (!data.phone) {
        errors.push('Phone number is required');
    } else if (!isValidPhone(data.phone)) {
        errors.push('Invalid phone number format. Please enter at least 10 digits.');
    }

    if (!data.ticketType) {
        errors.push('Ticket type is required');
    } else if (!isValidTicketType(data.ticketType)) {
        errors.push('Invalid ticket type');
    }

    if (!data.quantity) {
        errors.push('Quantity is required');
    } else if (!isValidQuantity(data.quantity)) {
        errors.push('Quantity must be between 1 and 10');
    }

    if (!data.pricePerTicket) {
        errors.push('Price is required');
    } else if (!isValidPrice(data.pricePerTicket)) {
        errors.push('Invalid price');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// Validate login data
function validateLoginData(data) {
    const errors = [];

    if (!data.email) {
        errors.push('Email is required');
    } else if (!isValidEmail(data.email)) {
        errors.push('Invalid email format');
    }

    if (!data.password) {
        errors.push('Password is required');
    } else if (data.password.length < 6) {
        errors.push('Password must be at least 6 characters');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    isValidEmail,
    isValidPhone,
    isValidTicketType,
    isValidQuantity,
    isValidPrice,
    sanitizeString,
    validateOrderData,
    validateLoginData
};
