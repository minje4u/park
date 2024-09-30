const mongoose = require('mongoose');

const fortuneLogSchema = new mongoose.Schema({
  groupNumber: String,
  accumulatedScore: {
    type: Number,
    default: 0,
    min: 0
  },
  fortune: String,
  luckyScore: Number,
  lastCheckedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('FortuneLog', fortuneLogSchema);
