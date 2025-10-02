// Checkout Flow JavaScript
// Use relative URL to work on both localhost and deployed environments
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

let currentStep = 1;
let selectedTickets = {
    regular: { quantity: 0, price: 10000 },
    vip: { quantity: 0, price: 30000 },
    bronze: { quantity: 0, price: 500000 },
    platinum: { quantity: 0, price: 1000000 }
};
let customerDetails = {};
let currentOrder = null;
let countdownInterval = null;
let uploadedFile = null;

// Initialize - using window.addEventListener to ensure it runs after everything
window.addEventListener('load', () => {
    console.log('=== CHECKOUT INITIALIZATION STARTED ===');
    console.log('Selected tickets object:', selectedTickets);

    try {
        setupTicketSelectors();
        console.log('✓ Ticket selectors setup complete');
    } catch (error) {
        console.error('✗ Error in setupTicketSelectors:', error);
    }

    try {
        setupFormHandlers();
        console.log('✓ Form handlers setup complete');
    } catch (error) {
        console.error('✗ Error in setupFormHandlers:', error);
    }

    try {
        setupUploadHandler();
        console.log('✓ Upload handler setup complete');
    } catch (error) {
        console.error('✗ Error in setupUploadHandler:', error);
    }

    try {
        setupCopyToClipboard();
        console.log('✓ Copy to clipboard setup complete');
    } catch (error) {
        console.error('✗ Error in setupCopyToClipboard:', error);
    }

    try {
        preSelectTicketFromURL();
        console.log('✓ Pre-select from URL complete');
    } catch (error) {
        console.error('✗ Error in preSelectTicketFromURL:', error);
    }

    console.log('=== CHECKOUT INITIALIZATION COMPLETE ===');
});

// Pre-select ticket if coming from ticket.html
function preSelectTicketFromURL() {
    const params = new URLSearchParams(window.location.search);
    const ticketType = params.get('type');

    if (ticketType && selectedTickets[ticketType]) {
        // Find the ticket card and set quantity to 1
        const ticketCard = document.querySelector(`.ticket-card[data-type="${ticketType}"]`);
        if (ticketCard) {
            const input = ticketCard.querySelector('.qty-input');
            if (input) {
                input.value = 1;
                selectedTickets[ticketType].quantity = 1;
                updateOrderSummary();

                // Highlight the selected card
                ticketCard.style.border = '2px solid #da3f08';
                ticketCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
}

// === STEP 1: TICKET SELECTION ===

function setupTicketSelectors() {
    console.log('Setting up ticket selectors...');

    // Get all ticket cards
    const cards = document.querySelectorAll('.ticket-card');
    console.log('Found ticket cards:', cards.length);

    cards.forEach((card) => {
        const type = card.getAttribute('data-type');
        const minusBtn = card.querySelector('.qty-btn.minus');
        const plusBtn = card.querySelector('.qty-btn.plus');
        const input = card.querySelector('.qty-input');

        if (!minusBtn || !plusBtn || !input) {
            console.error(`Missing elements in card for type: ${type}`);
            return;
        }

        console.log(`Setting up buttons for: ${type}`);

        // Remove any existing event listeners by cloning
        const newMinusBtn = minusBtn.cloneNode(true);
        const newPlusBtn = plusBtn.cloneNode(true);
        minusBtn.parentNode.replaceChild(newMinusBtn, minusBtn);
        plusBtn.parentNode.replaceChild(newPlusBtn, plusBtn);

        // Set up minus button
        newMinusBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log(`Minus clicked for ${type}, current: ${selectedTickets[type].quantity}`);

            if (selectedTickets[type].quantity > 0) {
                selectedTickets[type].quantity--;
                input.value = selectedTickets[type].quantity;
                updateOrderSummary();
                console.log(`New quantity: ${selectedTickets[type].quantity}`);
            }
        });

        // Set up plus button
        const maxQty = (type === 'bronze' || type === 'platinum') ? 5 : 10;
        newPlusBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log(`Plus clicked for ${type}, current: ${selectedTickets[type].quantity}`);

            if (selectedTickets[type].quantity < maxQty) {
                selectedTickets[type].quantity++;
                input.value = selectedTickets[type].quantity;
                updateOrderSummary();
                console.log(`New quantity: ${selectedTickets[type].quantity}`);
            } else {
                console.log(`Max quantity reached: ${maxQty}`);
            }
        });
    });

    // Set up next button
    const btnStep1 = document.getElementById('btnStep1');
    if (btnStep1) {
        btnStep1.addEventListener('click', () => {
            goToStep(2);
        });
    }

    console.log('Ticket selectors setup complete');
}

function updateOrderSummary() {
    const summaryContent = document.getElementById('summaryContent');
    const totalAmount = document.querySelector('.total-amount');
    const btnNext = document.getElementById('btnStep1');

    let total = 0;
    let hasTickets = false;
    let html = '';

    for (const [type, data] of Object.entries(selectedTickets)) {
        if (data.quantity > 0) {
            hasTickets = true;
            const subtotal = data.quantity * data.price;
            total += subtotal;

            const typeName = type.charAt(0).toUpperCase() + type.slice(1);
            html += `
                <div class="summary-item">
                    <span>${data.quantity}x ${typeName} Ticket</span>
                    <strong>₦ ${subtotal.toLocaleString()}</strong>
                </div>
            `;
        }
    }

    if (hasTickets) {
        summaryContent.innerHTML = html;
        totalAmount.textContent = `₦ ${total.toLocaleString()}`;
        btnNext.disabled = false;
    } else {
        summaryContent.innerHTML = '<p class="empty-summary">No tickets selected</p>';
        totalAmount.textContent = '₦ 0';
        btnNext.disabled = true;
    }
}

// === STEP 2: CUSTOMER DETAILS ===

function setupFormHandlers() {
    const form = document.getElementById('detailsForm');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        customerDetails = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value
        };

        await createOrder();
    });

    document.getElementById('btnBack1').addEventListener('click', () => {
        goToStep(1);
    });

    document.getElementById('btnBack2').addEventListener('click', () => {
        if (confirm('Going back will cancel your current order. Continue?')) {
            if (countdownInterval) clearInterval(countdownInterval);
            goToStep(2);
        }
    });
}

async function createOrder() {
    try {
        // Find selected ticket type (use first non-zero quantity)
        let ticketType = '';
        let quantity = 0;
        let pricePerTicket = 0;

        for (const [type, data] of Object.entries(selectedTickets)) {
            if (data.quantity > 0) {
                ticketType = type;
                quantity = data.quantity;
                pricePerTicket = data.price;
                break; // For simplicity, only handle one type at a time
            }
        }

        const orderData = {
            ...customerDetails,
            ticketType,
            quantity,
            pricePerTicket
        };

        console.log('Creating order with data:', orderData);

        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            let errorMessage = 'Failed to create order. Please try again.';

            try {
                const error = await response.json();
                console.error('Order creation failed:', error);

                // Show detailed error message
                if (error.details && error.details.length > 0) {
                    errorMessage = 'Please fix the following:\n\n' + error.details.join('\n');
                } else if (error.message) {
                    errorMessage = error.message;
                } else if (error.error) {
                    errorMessage = error.error;
                }
            } catch (e) {
                console.error('Could not parse error response:', e);
            }

            alert(errorMessage);
            throw new Error(errorMessage);
        }

        const result = await response.json();
        currentOrder = result.order || result;
        console.log('Order created successfully:', currentOrder);

        // Populate payment details
        document.getElementById('orderNumber').textContent = currentOrder.orderNumber;
        document.getElementById('referenceCode').textContent = currentOrder.referenceCode;
        document.getElementById('amountToPay').textContent = `₦ ${currentOrder.totalAmount.toLocaleString()}`;
        document.getElementById('bankReference').textContent = currentOrder.referenceCode;
        document.getElementById('paymentReference').textContent = currentOrder.referenceCode;

        // Start countdown
        startCountdown();

        goToStep(3);
    } catch (error) {
        console.error('Error creating order:', error);
        alert('Failed to create order. Please try again.');
    }
}

// === STEP 3: PAYMENT ===

function startCountdown() {
    if (!currentOrder || !currentOrder.expiresAt) return;

    const expiryTime = new Date(currentOrder.expiresAt).getTime();

    countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = expiryTime - now;

        if (distance < 0) {
            clearInterval(countdownInterval);
            document.getElementById('countdown').textContent = 'EXPIRED';
            document.getElementById('countdown').style.color = '#ff5252';
            document.getElementById('btnSubmitProof').disabled = true;
            alert('Your order has expired. Please start again.');
            return;
        }

        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('countdown').textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

function setupCopyToClipboard() {
    document.querySelectorAll('.copy-text').forEach(element => {
        element.addEventListener('click', () => {
            const text = element.textContent.trim();
            navigator.clipboard.writeText(text).then(() => {
                const original = element.textContent;
                element.textContent = '✓ Copied!';
                setTimeout(() => {
                    element.textContent = original;
                }, 2000);
            });
        });
    });
}

function setupUploadHandler() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const preview = document.getElementById('uploadPreview');
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    const previewImage = document.getElementById('previewImage');
    const btnSubmit = document.getElementById('btnSubmitProof');
    const btnRemove = document.getElementById('btnRemoveFile');

    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
        uploadArea.style.background = '#f8f9ff';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#ccc';
        uploadArea.style.background = '';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#ccc';
        uploadArea.style.background = '';

        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileSelect(file);
    });

    btnRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadedFile = null;
        fileInput.value = '';
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
        btnSubmit.disabled = true;
    });

    btnSubmit.addEventListener('click', submitPaymentProof);
}

function handleFileSelect(file) {
    // Validate file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
        alert('Only JPG, PNG, and PDF files are allowed');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
    }

    uploadedFile = file;

    // Show preview for images
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('previewImage').src = e.target.result;
            document.getElementById('uploadPreview').classList.remove('hidden');
            document.querySelector('.upload-placeholder').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    document.getElementById('btnSubmitProof').disabled = false;
}

async function submitPaymentProof() {
    if (!uploadedFile || !currentOrder) return;

    try {
        const formData = new FormData();
        formData.append('paymentProof', uploadedFile);

        const response = await fetch(`${API_BASE_URL}/orders/${currentOrder._id}/upload-proof`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Failed to upload proof');

        clearInterval(countdownInterval);

        document.getElementById('finalOrderNumber').textContent = currentOrder.orderNumber;

        goToStep(4);
    } catch (error) {
        console.error('Error uploading proof:', error);
        alert('Failed to upload payment proof. Please try again.');
    }
}

// === STEP 4: CONFIRMATION ===

document.getElementById('btnTrackOrder')?.addEventListener('click', () => {
    window.location.href = `track-order.html?order=${currentOrder.orderNumber}`;
});

// === NAVIGATION ===

function goToStep(step) {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`step${i}`).classList.add('hidden');
        document.querySelector(`[data-step="${i}"]`).classList.remove('active', 'completed');
    }

    // Mark previous steps as completed
    for (let i = 1; i < step; i++) {
        document.querySelector(`[data-step="${i}"]`).classList.add('completed');
    }

    // Show current step
    document.getElementById(`step${step}`).classList.remove('hidden');
    document.querySelector(`[data-step="${step}"]`).classList.add('active');

    currentStep = step;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
