const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const EmployeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  groupNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['worker', 'admin'], default: 'worker' },
  isInitialPassword: { type: Boolean, default: true },
  accumulatedScore: { type: Number, default: 0 }, // 누적 점수 필드 추가
  phoneNumber: { type: String }, // 전화번호 필드 추가
  address: { type: String }, // 주소 필드 추가
  nationality: { type: String }, // 국적 필드 추가
  residency: { type: String }, // 체류 필드 추가
  accountNumber: { type: String }, // 계좌번호 필드 추가
  previousAccountNumber: { type: String }, // 이전 계좌번호 필드 추가
  accountHolder: { type: String }, // 예금주 필드 추가
  hireDate: { type: String }, // 입사일자 필드 추가
  guaranteePeriod: { type: String }, // 보증기간 필드 추가
  idNumber: { type: String }, // 주민번호 필드
  isAccountNumberChecked: { type: Boolean, default: false }, // 계좌번호 확인 여부 필드 추가
  photo: { type: String }, // 사진 URL 필드 추가
  resignationDate: { type: String }, // 퇴사일자 URL 필드 추가
  bank: { type: String }, // 은행
  employmentstatus: { type: String }, // 고용 상태
});

// 필드 초기화 함수
const initializeFields = async () => {
  try {
    const employees = await Employee.find({});
    for (const employee of employees) {
      employee.phoneNumber = employee.phoneNumber || ''; // 값이 없으면 빈 문자열
      employee.address = employee.address || ''; // 값이 없으면 빈 문자열
      employee.nationality = employee.nationality || ''; // 값이 없으면 빈 문자열
      employee.residency = employee.residency || ''; // 값이 없으면 빈 문자열
      employee.accountNumber = employee.accountNumber || ''; // 값이 없으면 빈 문자열
      employee.accountHolder = employee.accountHolder || ''; // 값이 없으면 빈 문자열
      employee.hireDate = employee.hireDate || null; // hireDate는 null로 초기화
      employee.guaranteePeriod = employee.guaranteePeriod || ''; // 값이 없으면 빈 문자열
      employee.idNumber = employee.idNumber || ''; // 값이 없으면 빈 문자열
      employee.previousAccountNumber = employee.previousAccountNumber || ''; // 값이 없으면 빈 문자열
      employee.isAccountNumberChecked = employee.isAccountNumberChecked || false; // 기본값 false로 초기화
      employee.photo = employee.photo || '';
      employee.resignationDate = employee.resignationDate || '';
      employee.bank = employee.bank || '';
      employee.employmentstatus = employee.employmentstatus || '';
      await employee.save();
    }
    console.log('모든 직원의 필드가 초기화되었습니다.');
  } catch (error) {
    console.error('필드 초기화 중 오류 발생:', error);
  }
};

EmployeeSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

EmployeeSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

EmployeeSchema.methods.updateInfo = async function(updates) {
  try {
    Object.keys(updates).forEach(key => {
      if (this[key] !== undefined) {
        this[key] = updates[key];
      }
    });
    await this.save();
  } catch (error) {
    console.error('직원 정보를 업데이트하는 중 오류 발생:', error);
    throw new Error('직원 정보를 업데이트하는 데 실패했습니다.');
  }
};

const Employee = mongoose.model('Employee', EmployeeSchema);

module.exports = {
  Employee,
  initializeFields
};
