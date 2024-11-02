const mongoose = require('mongoose');

const AccountHistorySchema = new mongoose.Schema({
  groupNumber: { type: String, required: true },
  oldAccountNumber: { type: String, required: true },
  newAccountNumber: { type: String, required: true },
  reason: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const AccountHistory = mongoose.model('AccountHistory', AccountHistorySchema);

module.exports = AccountHistory;
