const mongoose = require('mongoose');

const readReceiptSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  read_at: { type: Date, default: Date.now },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  chat_type: { type: String, enum: ['group', 'individual'], required: true },
  content: { type: String, default: '' },
  image_url: { type: String, default: '' },
  file_url: { type: String, default: '' },
  file_name: { type: String, default: '' },
  file_type: { type: String, default: '' },
  is_deleted: { type: Boolean, default: false },
  read_by: [readReceiptSchema],
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Message', messageSchema);
