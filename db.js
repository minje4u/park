const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://park:1234@cluster0.defae.mongodb.net/myDatabase?retryWrites=true&w=majority");
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