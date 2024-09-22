const mongoose = require("mongoose");
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB에 성공적으로 연결되었습니다.");
  } catch (error) {
    console.error("MongoDB 연결 실패:", error.message);
    process.exit(1);
  }
};

const WorkSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true
  },
  employeeName: {
    type: String,
    required: true
  },
  groupNumber: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  workHours: {
    type: Number,
    required: true
  },
  totalWeight: {
    type: Number,
    required: true
  },
  payment: {
    type: Number,
    required: true
  }
}, { timestamps: true });

const Work = mongoose.model('Work', WorkSchema);

module.exports = { connectDB, Work };