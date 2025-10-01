const mongoose = require('mongoose');
const QRCode = require('qrcode');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  ticketType: {
    type: String,
    enum: ['regular', 'vip', 'bronze', 'platinum'],
    required: true
  },
  qrCode: {
    type: String,
    required: true
  },
  qrCodeImage: {
    type: String, // Base64 encoded image
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'used', 'cancelled', 'expired'],
    default: 'active'
  },
  usedAt: Date
}, {
  timestamps: true
});

// Generate unique ticket number: HP-001234
ticketSchema.statics.generateTicketNumber = async function() {
  const lastTicket = await this.findOne().sort({ ticketNumber: -1 });

  let sequence = 1;
  if (lastTicket) {
    const lastNumber = parseInt(lastTicket.ticketNumber.split('-')[1]);
    sequence = lastNumber + 1;
  }

  return `HP-${String(sequence).padStart(6, '0')}`;
};

// Generate QR code data
ticketSchema.statics.generateQRCodeData = function(ticketNumber, userId, ticketType) {
  return JSON.stringify({
    ticket: ticketNumber,
    user: userId.toString(),
    type: ticketType,
    event: 'Hive Party 2025',
    issued: new Date().toISOString()
  });
};

// Generate QR code image
ticketSchema.statics.generateQRCodeImage = async function(qrData) {
  try {
    // Generate QR code as data URL (base64)
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

// Create tickets for an approved order
ticketSchema.statics.createFromOrder = async function(order) {
  const tickets = [];

  for (let i = 0; i < order.quantity; i++) {
    const ticketNumber = await this.generateTicketNumber();
    const qrCode = this.generateQRCodeData(ticketNumber, order.userId, order.ticketType);
    const qrCodeImage = await this.generateQRCodeImage(qrCode);

    const ticket = await this.create({
      ticketNumber,
      orderId: order._id,
      userId: order.userId,
      userEmail: order.userEmail,
      userName: order.userName,
      ticketType: order.ticketType,
      qrCode,
      qrCodeImage
    });

    tickets.push(ticket);
  }

  return tickets;
};

// Verify ticket (for scanning at entrance)
ticketSchema.statics.verify = async function(ticketNumber) {
  const ticket = await this.findOne({ ticketNumber });

  if (!ticket) {
    return { valid: false, reason: 'Ticket not found' };
  }

  if (ticket.status === 'used') {
    return { valid: false, reason: 'Ticket already used', usedAt: ticket.usedAt };
  }

  if (ticket.status === 'cancelled') {
    return { valid: false, reason: 'Ticket cancelled' };
  }

  if (ticket.status === 'expired') {
    return { valid: false, reason: 'Ticket expired' };
  }

  return {
    valid: true,
    ticket: {
      ticketNumber: ticket.ticketNumber,
      userName: ticket.userName,
      ticketType: ticket.ticketType
    }
  };
};

// Mark ticket as used
ticketSchema.methods.markAsUsed = async function() {
  this.status = 'used';
  this.usedAt = new Date();
  await this.save();
  return this;
};

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
