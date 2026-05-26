const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  status: { type: String, enum: ['active', 'inactive', 'trial', 'expired'], default: 'trial' },
  started_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true },
  amount_paid: { type: Number, default: 0 },
  payment_id: { type: String, default: '' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Subscription', subscriptionSchema);
