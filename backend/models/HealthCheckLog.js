const mongoose = require('mongoose');

const healthCheckLogSchema = new mongoose.Schema({
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  url: { type: String, required: true },
  status: { type: String, enum: ['up', 'slow', 'down'], required: true },
  http_status: { type: Number, default: 0 },
  response_ms: { type: Number, default: 0 },
  error: { type: String, default: '' },
  checked_at: { type: Date, default: Date.now },
});

healthCheckLogSchema.index({ team_id: 1, checked_at: -1 });
// Keep 30 days of history only.
healthCheckLogSchema.index({ checked_at: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model('HealthCheckLog', healthCheckLogSchema);
