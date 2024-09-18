const mongoose = require("mongoose");

const WorkSchema = new mongoose.Schema({
  date: Date,
  조: Number,
  employeeId: String,
  employeeName: String, // 작업자명 필드 추가
  weight: Number,
  workHours: Number, // 작업시간 필드 추가
  totalWeight: Number,
  payment: Number
});

module.exports = mongoose.model('Work', WorkSchema);
