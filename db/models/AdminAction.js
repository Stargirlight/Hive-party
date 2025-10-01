const mongoose = require('mongoose');

const adminActionSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminEmail: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['approve_order', 'decline_order', 'cancel_ticket', 'refund_payment', 'mark_ticket_used'],
    required: true
  },
  targetType: {
    type: String,
    enum: ['order', 'ticket', 'payment'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  reason: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Log admin action
adminActionSchema.statics.log = async function(actionData) {
  return this.create(actionData);
};

// Get recent actions
adminActionSchema.statics.getRecent = function(limit = 100) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('adminId', 'name email');
};

const AdminAction = mongoose.model('AdminAction', adminActionSchema);

module.exports = AdminAction;
