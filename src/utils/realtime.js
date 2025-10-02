// Real-time updates using Server-Sent Events (SSE)
const Order = require('../db/models/Order');

class RealtimeService {
    constructor() {
        this.clients = new Set();
    }

    // Add client to SSE stream
    addClient(res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        this.clients.add(res);

        // Send initial connection message
        this.sendToClient(res, { type: 'connected', message: 'Connected to real-time updates' });

        // Remove client on disconnect
        res.on('close', () => {
            this.clients.delete(res);
        });
    }

    // Send event to specific client
    sendToClient(res, data) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    // Broadcast to all connected clients
    broadcast(data) {
        this.clients.forEach(client => {
            this.sendToClient(client, data);
        });
    }

    // Notify about new pending order
    notifyNewOrder(order) {
        this.broadcast({
            type: 'new_order',
            order
        });
    }

    // Notify about order status change
    notifyOrderUpdate(orderId, status) {
        this.broadcast({
            type: 'order_updated',
            orderId,
            status
        });
    }

    // Notify about stats update
    notifyStatsUpdate(stats) {
        this.broadcast({
            type: 'stats_updated',
            stats
        });
    }
}

// Singleton instance
const realtimeService = new RealtimeService();

// Auto-refresh stats every 30 seconds
setInterval(async () => {
    try {
        const stats = await Order.getStats();
        let pending = 0;
        let approved = 0;
        let revenue = 0;

        stats.forEach(stat => {
            if (stat._id === 'pending_confirmation') pending = stat.count;
            else if (stat._id === 'approved') {
                approved = stat.count;
                revenue = stat.totalAmount;
            }
        });

        realtimeService.notifyStatsUpdate({ pending, approved, revenue });
    } catch (error) {
        console.error('Error auto-refreshing stats:', error);
    }
}, 30000);

module.exports = realtimeService;
