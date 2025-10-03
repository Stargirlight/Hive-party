const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  referenceCode: {
    type: String,
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
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  pricePerTicket: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending_payment', 'pending_confirmation', 'approved', 'declined', 'expired', 'cancelled'],
    default: 'pending_payment'
  },
  paymentProofUrl: String, // Deprecated - kept for backward compatibility
  paymentProof: {
    data: String, // base64 encoded
    contentType: String,
    filename: String,
    uploadedAt: Date
  },
  expiresAt: Date,
  confirmedAt: Date,
  adminNotes: String
}, {
  timestamps: true
});

// Generate unique order number: TCK-20251001-001
orderSchema.statics.generateOrderNumber = async function() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

  const lastOrder = await this.findOne({
    orderNumber: new RegExp(`^TCK-${dateStr}`)
  }).sort({ orderNumber: -1 });

  let sequence = 1;
  if (lastOrder) {
    const lastNumber = parseInt(lastOrder.orderNumber.split('-')[2]);
    sequence = lastNumber + 1;
  }

  return `TCK-${dateStr}-${String(sequence).padStart(3, '0')}`;
};

// Generate reference code: REF-20251001-1234
orderSchema.statics.generateReferenceCode = function() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000);
  return `REF-${dateStr}-${String(random).padStart(4, '0')}`;
};

// Create order with auto-generated fields
orderSchema.statics.createOrder = async function(orderData) {
  const orderNumber = await this.generateOrderNumber();
  const referenceCode = this.generateReferenceCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  const order = await this.create({
    orderNumber,
    referenceCode,
    ...orderData,
    totalAmount: orderData.pricePerTicket * orderData.quantity,
    expiresAt
  });

  return order;
};

// Get pending orders
orderSchema.statics.getPendingOrders = function() {
  return this.find({ status: 'pending_confirmation' })
    .sort({ createdAt: 1 });
};

// Get order statistics
orderSchema.statics.getStats = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);
};

// Expire old orders
orderSchema.statics.expireOldOrders = function() {
  return this.updateMany(
    {
      status: 'pending_payment',
      expiresAt: { $lt: new Date() }
    },
    {
      $set: { status: 'expired' }
    }
  );
};

// Upload payment proof
orderSchema.methods.uploadPaymentProof = async function(proofData) {
  // Support both old (string URL) and new (object with base64) formats
  if (typeof proofData === 'string') {
    this.paymentProofUrl = proofData;
  } else {
    this.paymentProof = proofData;
  }
  this.status = 'pending_confirmation';
  await this.save();
  return this;
};

// Approve order
orderSchema.methods.approve = async function(adminNotes) {
  this.status = 'approved';
  this.confirmedAt = new Date();
  if (adminNotes) this.adminNotes = adminNotes;
  await this.save();
  return this;
};

// Decline order
orderSchema.methods.decline = async function(reason) {
  this.status = 'declined';
  if (reason) this.adminNotes = reason;
  await this.save();
  return this;
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
