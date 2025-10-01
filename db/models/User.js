const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['customer', 'admin', 'super_admin'],
    default: 'customer'
  }
}, {
  timestamps: true
});

// Methods
userSchema.statics.findOrCreate = async function(email, name, phone) {
  let user = await this.findOne({ email });

  if (!user) {
    user = await this.create({ email, name, phone });
  }

  return user;
};

userSchema.methods.isAdmin = function() {
  return this.role === 'admin' || this.role === 'super_admin';
};

const User = mongoose.model('User', userSchema);

module.exports = User;
