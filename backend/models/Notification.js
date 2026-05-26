const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // legacy field name
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, required: true },
  title: { type: String, default: '' },
  message: { type: String, required: true },
  is_read: { type: Boolean, default: false },
  reference_id: { type: mongoose.Schema.Types.ObjectId },
  reference_type: { type: String },
  // legacy fields
  related_id: { type: mongoose.Schema.Types.ObjectId },
  related_model: { type: String },
  action_token: { type: String },
  action_status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: null,
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Notification', notificationSchema);

notificationSchema.index({ college_id: 1 });
