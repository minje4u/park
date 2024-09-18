const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const EmployeeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['worker', 'admin'], default: 'worker' },
  isInitialPassword: { type: Boolean, default: true } // 초기 비밀번호 여부를 저장하는 필드 추가
});

// 비밀번호 저장 전 해시화 (초기 비밀번호가 아닌 경우에만)
EmployeeSchema.pre('save', async function(next) {
  if (!this.isModified('password') || this.isInitialPassword) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 비밀번호 비교 메서드
EmployeeSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    if (this.isInitialPassword) {
      return this.password === candidatePassword;
    }
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

module.exports = mongoose.model('Employee', EmployeeSchema);
