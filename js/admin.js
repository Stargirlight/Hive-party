// Admin Dashboard JavaScript
// Use relative URL to work on both localhost and deployed environments
const API_BASE_URL = '/api';

let allOrders = [];
let currentFilter = 'all'; // Changed from 'pending_confirmation' to show all by default

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
});

async function checkAuthentication() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/status`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = './login.html';
            return;
        }

        // Update admin email display
        if (data.admin) {
            document.getElementById('adminEmail').textContent = data.admin.email;
        }

        initializeDashboard();
        setupEventListeners();
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = './login.html';
    }
}

async function initializeDashboard() {
    await loadStats();
    await loadOrders();
    connectRealtime();
}

function setupEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await loadStats();
        await loadOrders();
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            try {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    credentials: 'include'
                });
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = 'login.html';
            }
        }
    });

    // Filters
    document.getElementById('statusFilter').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        filterOrders();
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterOrders();
    });

    document.getElementById('dateFilter').addEventListener('change', (e) => {
        filterOrders();
    });

    // Modal close buttons
    document.getElementById('closeModal').addEventListener('click', closeOrderModal);
    document.getElementById('closeProofModal').addEventListener('click', closeProofModal);

    // Close modal on outside click
    document.getElementById('orderModal').addEventListener('click', (e) => {
        if (e.target.id === 'orderModal') closeOrderModal();
    });

    document.getElementById('proofModal').addEventListener('click', (e) => {
        if (e.target.id === 'proofModal') closeProofModal();
    });
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Stats API error:', response.status, errorText);
            throw new Error(`API returned ${response.status}`);
        }

        const stats = await response.json();
        console.log('Stats loaded:', stats);

        document.getElementById('pendingCount').textContent = stats.pending || 0;
        document.getElementById('approvedCount').textContent = stats.approved || 0;
        document.getElementById('totalRevenue').textContent = `NGN ${formatNumber(stats.revenue || 0)}`;
        document.getElementById('ticketsSold').textContent = stats.ticketsSold || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
        // Show actual data (zeros) instead of mock data
        document.getElementById('pendingCount').textContent = '0';
        document.getElementById('approvedCount').textContent = '0';
        document.getElementById('totalRevenue').textContent = 'NGN 0';
        document.getElementById('ticketsSold').textContent = '0';
    }
}

function updateMockStats() {
    document.getElementById('pendingCount').textContent = '3';
    document.getElementById('approvedCount').textContent = '12';
    document.getElementById('totalRevenue').textContent = 'NGN 48,000';
    document.getElementById('ticketsSold').textContent = '24';
}

// Load orders
async function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8"><div class="loading-spinner">Loading orders...</div></td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders`, {
            credentials: 'include'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Orders API error:', response.status, errorText);
            throw new Error(`API returned ${response.status}`);
        }

        allOrders = await response.json();
        console.log('Orders loaded:', allOrders);

        // Normalize order objects (PHP uses 'id', JS expects '_id')
        allOrders = allOrders.map(order => {
            if (order.id && !order._id) {
                order._id = order.id;
            }
            return order;
        });

        filterOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
        // Show empty state instead of mock data
        allOrders = [];
        filterOrders();
    }
}

// Filter orders based on current selections
function filterOrders() {
    let filtered = [...allOrders];

    // Filter by status
    if (currentFilter !== 'all') {
        filtered = filtered.filter(order => order.status === currentFilter);
    }

    // Filter by search
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(order =>
            order.orderNumber.toLowerCase().includes(searchTerm) ||
            order.userEmail.toLowerCase().includes(searchTerm) ||
            order.userName.toLowerCase().includes(searchTerm)
        );
    }

    // Filter by date
    const dateFilter = document.getElementById('dateFilter').value;
    if (dateFilter) {
        filtered = filtered.filter(order => {
            const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
            return orderDate === dateFilter;
        });
    }

    renderOrders(filtered);
}

// Render orders table
function renderOrders(orders) {
    const tbody = document.getElementById('ordersTableBody');

    if (orders.length === 0) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="8"><div class="empty-state">No orders found</div></td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td><strong>${order.orderNumber}</strong></td>
            <td>
                <div>${order.userName}</div>
                <div style="font-size: 12px; color: #666;">${order.userEmail}</div>
            </td>
            <td><span style="text-transform: capitalize;">${order.ticketType}</span></td>
            <td>${order.quantity}</td>
            <td><strong>NGN ${formatNumber(order.totalAmount)}</strong></td>
            <td><span class="status-badge status-${order.status}">${formatStatus(order.status)}</span></td>
            <td>${formatDate(order.createdAt)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-view" onclick="viewOrder('${order._id}')">View</button>
                    ${['pending_confirmation', 'pending_verification', 'pending_payment'].includes(order.status) ? `
                        <button class="btn btn-approve" onclick="approveOrder('${order._id}')">Approve</button>
                        <button class="btn btn-decline" onclick="declineOrder('${order._id}')">Decline</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// View order details
async function viewOrder(orderId) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, { credentials: 'include' });
        const order = await response.json();
        showOrderModal(order);
    } catch (error) {
        console.error('Error loading order:', error);
        // Find in mock data
        const order = allOrders.find(o => o._id === orderId);
        if (order) showOrderModal(order);
    }
}

function showOrderModal(order) {
    const modal = document.getElementById('orderModal');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="order-detail">
            <label>Order Number</label>
            <p><strong>${order.orderNumber}</strong></p>
        </div>
        <div class="order-detail">
            <label>Reference Code</label>
            <p>${order.referenceCode || 'N/A'}</p>
        </div>
        <div class="order-detail">
            <label>Customer Name</label>
            <p>${order.userName}</p>
        </div>
        <div class="order-detail">
            <label>Customer Email</label>
            <p>${order.userEmail}</p>
        </div>
        <div class="order-detail">
            <label>Ticket Type</label>
            <p style="text-transform: capitalize;">${order.ticketType}</p>
        </div>
        <div class="order-detail">
            <label>Quantity</label>
            <p>${order.quantity} ticket(s)</p>
        </div>
        <div class="order-detail">
            <label>Price Per Ticket</label>
            <p>NGN ${formatNumber(order.pricePerTicket)}</p>
        </div>
        <div class="order-detail">
            <label>Total Amount</label>
            <p><strong>NGN ${formatNumber(order.totalAmount)}</strong></p>
        </div>
        <div class="order-detail">
            <label>Status</label>
            <p><span class="status-badge status-${order.status}">${formatStatus(order.status)}</span></p>
        </div>
        <div class="order-detail">
            <label>Created At</label>
            <p>${formatFullDate(order.createdAt)}</p>
        </div>
        ${order.paymentProofUrl ? `
            <div class="order-detail">
                <label>Payment Proof</label>
                <p><a href="#" class="proof-link" onclick="showProofImage('${order.paymentProofUrl}'); return false;">View Payment Proof</a></p>
            </div>
        ` : ''}
        ${order.adminNotes ? `
            <div class="order-detail">
                <label>Admin Notes</label>
                <p>${order.adminNotes}</p>
            </div>
        ` : ''}
        ${order.status === 'pending_confirmation' ? `
            <div class="order-detail">
                <label>Admin Notes (Optional)</label>
                <textarea class="notes-input" id="adminNotes" placeholder="Add notes about this order..."></textarea>
            </div>
            <div class="modal-actions">
                <button class="btn btn-approve btn-large" onclick="approveOrderFromModal('${order._id}')">✓ Approve Order</button>
                <button class="btn btn-decline btn-large" onclick="declineOrderFromModal('${order._id}')">✗ Decline Order</button>
            </div>
        ` : ''}
    `;

    modal.classList.add('active');
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
}

function showProofImage(imageUrl) {
    const modal = document.getElementById('proofModal');
    const img = document.getElementById('proofImage');
    img.src = imageUrl;
    modal.classList.add('active');
}

function closeProofModal() {
    document.getElementById('proofModal').classList.remove('active');
}

// Approve order
async function approveOrder(orderId) {
    if (!confirm('Are you sure you want to approve this order?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/approve`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            alert('Order approved successfully! Tickets have been generated.');
            await loadStats();
            await loadOrders();
        } else {
            alert('Error approving order');
        }
    } catch (error) {
        console.error('Error approving order:', error);
        // Mock approval for development
        mockApproveOrder(orderId);
    }
}

async function approveOrderFromModal(orderId) {
    const notes = document.getElementById('adminNotes').value;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/approve`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminNotes: notes })
        });

        if (response.ok) {
            alert('Order approved successfully! Tickets have been generated.');
            closeOrderModal();
            await loadStats();
            await loadOrders();
        } else {
            alert('Error approving order');
        }
    } catch (error) {
        console.error('Error approving order:', error);
        mockApproveOrder(orderId);
        closeOrderModal();
    }
}

// Decline order
async function declineOrder(orderId) {
    const reason = prompt('Reason for declining (optional):');
    if (reason === null) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/decline`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });

        if (response.ok) {
            alert('Order declined');
            await loadStats();
            await loadOrders();
        } else {
            alert('Error declining order');
        }
    } catch (error) {
        console.error('Error declining order:', error);
        mockDeclineOrder(orderId);
    }
}

async function declineOrderFromModal(orderId) {
    const notes = document.getElementById('adminNotes').value || prompt('Reason for declining (optional):');
    if (notes === null) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/decline`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: notes })
        });

        if (response.ok) {
            alert('Order declined');
            closeOrderModal();
            await loadStats();
            await loadOrders();
        } else {
            alert('Error declining order');
        }
    } catch (error) {
        console.error('Error declining order:', error);
        mockDeclineOrder(orderId);
        closeOrderModal();
    }
}

// Mock functions for development
function mockApproveOrder(orderId) {
    const order = allOrders.find(o => o._id === orderId);
    if (order) {
        order.status = 'approved';
        order.confirmedAt = new Date().toISOString();
        filterOrders();
        alert('Order approved (mock)');
    }
}

function mockDeclineOrder(orderId) {
    const order = allOrders.find(o => o._id === orderId);
    if (order) {
        order.status = 'declined';
        filterOrders();
        alert('Order declined (mock)');
    }
}

// Utility functions
function formatNumber(num) {
    return num.toLocaleString('en-US');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatStatus(status) {
    return status.replace(/_/g, ' ');
}

// Real-time updates using Server-Sent Events
function connectRealtime() {
    const eventSource = new EventSource(`${API_BASE_URL}/realtime`);

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'connected':
                console.log('✅ Connected to real-time updates');
                break;

            case 'new_order':
                console.log('📨 New order received:', data.order);
                loadOrders(); // Reload orders
                loadStats();  // Update stats
                showNotification('New Order', `Order ${data.order.orderNumber} received`);
                break;

            case 'order_updated':
                console.log('🔄 Order updated:', data.orderId);
                loadOrders();
                loadStats();
                break;

            case 'stats_updated':
                // Update stats quietly without full reload
                if (data.stats.pending !== undefined) {
                    document.getElementById('pendingCount').textContent = data.stats.pending;
                }
                if (data.stats.approved !== undefined) {
                    document.getElementById('approvedCount').textContent = data.stats.approved;
                }
                if (data.stats.revenue !== undefined) {
                    document.getElementById('totalRevenue').textContent = `NGN ${formatNumber(data.stats.revenue)}`;
                }
                break;
        }
    };

    eventSource.onerror = (error) => {
        console.error('❌ Real-time connection error:', error);
        eventSource.close();
        // Retry connection after 5 seconds
        setTimeout(connectRealtime, 5000);
    };
}

// Show browser notification (if permitted)
function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
    }
}

// Request notification permission on load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Mock data for development
function getMockOrders() {
    return [
        {
            _id: '1',
            orderNumber: 'TCK-20251001-001',
            referenceCode: 'REF-20251001-1234',
            userId: 'user1',
            userEmail: 'john.doe@example.com',
            userName: 'John Doe',
            ticketType: 'vip',
            quantity: 2,
            pricePerTicket: 5000,
            totalAmount: 10000,
            status: 'pending_confirmation',
            paymentProofUrl: 'https://via.placeholder.com/600x400?text=Payment+Proof',
            createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
            _id: '2',
            orderNumber: 'TCK-20251001-002',
            referenceCode: 'REF-20251001-5678',
            userId: 'user2',
            userEmail: 'jane.smith@example.com',
            userName: 'Jane Smith',
            ticketType: 'regular',
            quantity: 3,
            pricePerTicket: 2000,
            totalAmount: 6000,
            status: 'pending_confirmation',
            paymentProofUrl: 'https://via.placeholder.com/600x400?text=Payment+Proof+2',
            createdAt: new Date(Date.now() - 7200000).toISOString()
        },
        {
            _id: '3',
            orderNumber: 'TCK-20250930-015',
            referenceCode: 'REF-20250930-9999',
            userId: 'user3',
            userEmail: 'bob.wilson@example.com',
            userName: 'Bob Wilson',
            ticketType: 'student',
            quantity: 1,
            pricePerTicket: 1500,
            totalAmount: 1500,
            status: 'pending_confirmation',
            paymentProofUrl: 'https://via.placeholder.com/600x400?text=Payment+Proof+3',
            createdAt: new Date(Date.now() - 10800000).toISOString()
        },
        {
            _id: '4',
            orderNumber: 'TCK-20250930-014',
            referenceCode: 'REF-20250930-8888',
            userId: 'user4',
            userEmail: 'alice.brown@example.com',
            userName: 'Alice Brown',
            ticketType: 'vip',
            quantity: 4,
            pricePerTicket: 5000,
            totalAmount: 20000,
            status: 'approved',
            confirmedAt: new Date(Date.now() - 86400000).toISOString(),
            createdAt: new Date(Date.now() - 172800000).toISOString()
        }
    ];
}
