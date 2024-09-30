const mongoose = require('mongoose');

const pointHistorySchema = new mongoose.Schema({
  groupNumber: {
    type: String,
    required: true
  },
  changeAmount: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['관리자변경', '운세확인획득', '행운상점구매']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  details: {
    type: String
  }
});

module.exports = mongoose.model('PointHistory', pointHistorySchema);