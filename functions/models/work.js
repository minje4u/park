const mongoose = require("mongoose");

const WorkSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  조: { type: Number, required: true },
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  weight: { type: Number, required: true },
  workHours: { type: Number, required: true },
  totalWeight: { type: Number, required: true },
  payment: { type: Number, required: true }
});

module.exports = mongoose.model('Work', WorkSchema);
