const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'moderator'],
        default: 'admin'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: Date
}, {
    timestamps: true
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
adminSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Update last login
adminSchema.methods.updateLastLogin = async function() {
    this.lastLogin = new Date();
    await this.save();
};

// Create default admin if none exists
adminSchema.statics.createDefaultAdmin = async function() {
    const adminCount = await this.countDocuments();

    if (adminCount === 0) {
        const defaultAdmin = await this.create({
            email: 'admin@hiveparty.com',
            password: 'admin123', // Will be hashed by pre-save hook
            name: 'System Administrator',
            role: 'super_admin'
        });

        console.log('✅ Default admin created:');
        console.log('   Email: admin@hiveparty.com');
        console.log('   Password: admin123');
        console.log('   ⚠️  Please change this password immediately!');

        return defaultAdmin;
    }
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
