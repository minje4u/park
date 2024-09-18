require('dotenv').config();
console.log('MONGODB_URI:', process.env.MONGODB_URI);

const mongoose = require('mongoose');
const Employee = require('./models/employee');
const Work = require('./models/work');
const Notice = require('./models/notice');
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

const app = express();
const router = express.Router();

// CORS 설정
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://parkkk.netlify.app'
    : 'http://localhost:3000'
}));

// JSON 파싱 미들웨어 추가
app.use(express.json());

// 라우터 설정
app.use('/.netlify/functions/api', router);

// MongoDB 연결
let conn = null;
const connectDB = async () => {
  if (conn == null) {
    conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('MongoDB connected successfully');
    await createInitialAdminAccount();
  }
  return conn;
};

const createInitialAdminAccount = async () => {
  try {
    const adminExists = await Employee.findOne({ role: 'admin' });
    if (!adminExists) {
      const newAdmin = new Employee({
        name: 'admin',
        employeeId: 'ADMIN001',
        password: '0000',
        role: 'admin',
        isInitialPassword: true
      });
      await newAdmin.save();
      console.log('초기 관리자 계정이 생성되었습니다.');
    } else {
      console.log('관리자 계정이 이미 존재합니다.');
    }
  } catch (error) {
    console.error('초기 관리자 계정 생성 중 오류 발생:', error);
  }
};

// 로그인 라우트
router.post('/login', async (req, res) => {
  console.log('Login request received:', req.body);
  try {
    await connectDB();
    const { name, password } = req.body;
    console.log('Searching for employee:', name);
    const employee = await Employee.findOne({ name });
    console.log('Employee found:', employee);
    if (!employee) {
      console.log('Login failed: Employee not found');
      return res.status(401).json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' });
    }
    const isMatch = await employee.comparePassword(password);
    console.log('Password match:', isMatch);
    if (!isMatch) {
      console.log('Login failed: Incorrect password');
      return res.status(401).json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' });
    }
    console.log('Login successful');
    res.json({ 
      name: employee.name, 
      role: employee.role,
      isInitialPassword: employee.isInitialPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 다른 라우트들도 여기에 추가...

router.get('/employee/work', async (req, res) => {
  try {
    await connectDB();
    const { year, month } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const works = await Work.find({
      date: { $gte: startDate, $lte: endDate }
    });
    
    console.log('Fetched works:', works);
    res.json(works);
  } catch (error) {
    console.error('Error fetching works:', error);
    res.status(500).json({ error: '작업 정보를 가져오는 데 실패했습니다.' });
  }
});

// 공지사항 관련 엔드포인트
router.get('/notices', async (req, res) => {
  try {
    await connectDB();
    const notices = await Notice.find().sort({ dateTime: -1 });
    res.json(notices);
  } catch (error) {
    console.error('Error fetching notices:', error);
    res.status(500).json({ error: '공지사항을 가져오는 데 실패했습니다.' });
  }
});

router.post('/notices', async (req, res) => {
  try {
    await connectDB();
    const { title, content } = req.body;
    const newNotice = new Notice({ title, content });
    await newNotice.save();
    res.status(201).json(newNotice);
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({ error: '공지사항 생성에 실패했습니다.' });
  }
});

router.put('/notices/:id', async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    const { title, content } = req.body;
    const updatedNotice = await Notice.findByIdAndUpdate(id, { title, content }, { new: true });
    res.json(updatedNotice);
  } catch (error) {
    console.error('Error updating notice:', error);
    res.status(500).json({ error: '공지사항 수정에 실패했습니다.' });
  }
});

router.delete('/notices/:id', async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    await Notice.findByIdAndDelete(id);
    res.json({ message: '공지사항이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting notice:', error);
    res.status(500).json({ error: '공지사항 삭제에 실패했습니다.' });
  }
});

router.get('/employees', async (req, res) => {
  try {
    await connectDB();
    const employees = await Employee.find();
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: '직원 정보를 가져오는 데 실패했습니다.' });
  }
});

// ... (다른 필요한 엔드포인트 추가)

router.post('/employees', async (req, res) => {
  try {
    await connectDB();
    const { name, employeeId, role, password } = req.body;
    const newEmployee = new Employee({ name, employeeId, role, password });
    await newEmployee.save();
    res.status(201).json({ message: "직원이 성공적으로 추가되었습니다.", employee: newEmployee });
  } catch (error) {
    console.error('Error adding employee:', error);
    res.status(500).json({ error: '직원 추가에 실패했습니다.' });
  }
});

router.post('/employee/work', async (req, res) => {
  try {
    await connectDB();
    const { employeeId, date, workType, workAmount } = req.body;
    
    const newWork = new Work({
      employeeId,
      date,
      workType,
      workAmount
    });

    await newWork.save();
    console.log('New work saved:', newWork);
    res.status(201).json({ message: "작업이 성공적으로 저장되었습니다.", work: newWork });
  } catch (error) {
    console.error('Error saving work:', error);
    res.status(500).json({ error: '작업 저장에 실패했습니다.' });
  }
});

router.post('/employee/work/bulk', async (req, res) => {
  try {
    const { date, workData } = req.body;
    const workDate = new Date(date + 'T00:00:00.000Z');
    
    const bulkOps = workData.map(work => ({
      updateOne: {
        filter: { 
          date: workDate,
          employeeId: work.employeeId
        },
        update: {
          $set: {
            조: work.조,
            employeeName: work.employeeName,
            weight: work.weight,
            workHours: work.workHours,
            totalWeight: work.totalWeight,
            payment: work.payment
          }
        },
        upsert: true
      }
    }));

    await Work.bulkWrite(bulkOps);
    res.status(201).json({ message: "작업이 성공적으로 일괄 저장되었습니다." });
  } catch (error) {
    console.error('Error saving bulk work data:', error);
    res.status(500).json({ error: '작업 일괄 저장에 실패했습니다.' });
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const { name, newPassword } = req.body;
    const employee = await Employee.findOne({ name });
    if (!employee) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    employee.password = newPassword;
    employee.isInitialPassword = false;
    await employee.save();
    res.json({ message: "비밀번호가 성공적으로 변경되었습니다." });
  } catch (error) {
    console.error('비밀번호 변경 중 오류:', error);
    res.status(500).json({ error: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
});

// 작업자 삭제
router.delete('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Employee.findByIdAndDelete(id);
    if (result) {
      res.json({ message: '작업자가 성공적으로 삭제되었습니다.' });
    } else {
      res.status(404).json({ error: '해당 작업자를 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('작업자 삭제 중 오류:', error);
    res.status(500).json({ error: '작업자 삭제 중 오류가 발생했습니다.' });
  }
});

// 특정 날짜의 작업 데이터 삭제
router.delete('/employee/work/:date', async (req, res) => {
  console.log('삭제 요청 받음:', req.params);
  try {
    const { date } = req.params;
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    console.log('삭제 범위:', startOfDay, '-', endOfDay);

    const result = await Work.deleteMany({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    console.log('삭제 결과:', result);

    if (result.deletedCount > 0) {
      res.json({ message: `${date} 데이터가 성공적으로 삭제되었습니다. (${result.deletedCount}개 항목 삭제)` });
    } else {
      res.status(404).json({ error: '해당 날짜의 데이터를 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('작업 데이터 삭제 중 오류:', error);
    res.status(500).json({ error: '작업 데이터 삭제 중 오류가 발생했습니다.' });
  }
});

// 데이터베이스 초기화 라우트
router.post('/reset-database', async (req, res) => {
  console.log('데이터베이스 초기화 요청 받음');
  try {
    await connectDB();
    
    // 모든 컬렉션 삭제
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
      console.log(`${key} 컬렉션이 초기화되었습니다.`);
    }

    // 초기 관리자 계정 생성
    await createInitialAdminAccount();

    console.log('데이터베이스 초기화 완료');
    res.json({ message: '데이터베이스가 성공적으로 초기화되었습니다.' });
  } catch (error) {
    console.error('데이터베이스 초기화 중 오류 발생:', error);
    res.status(500).json({ error: '데이터베이스 초기화 중 오류가 발생했습니다.' });
  }
});

// 서버 시작 시 데이터베이스 연결 및 초기 관리자 계정 생성
connectDB().then(() => {
  console.log('서버가 시작되었습니다.');
}).catch(err => {
  console.error('서버 시작 중 오류 발생:', err);
});

const handler = serverless(app);
module.exports = { handler };
