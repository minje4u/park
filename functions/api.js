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

const getWorkerData = require('./getWorkerData');

// 그리고 라우트 정의를 다음과 같이 수정하세요
app.get('/getWorkerData', (req, res) => getWorkerData(req, res));

module.exports.handler = serverless(app);

// CORS 미들웨어 설정
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://parkpa.netlify.app',
      'http://localhost:3000',
      'https://admin.parkpa.netlify.app'
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// JSON 파싱 미들웨어 추가
app.use(express.json());

// 라우터 설정
app.use('/.netlify/functions/api', router);

// MongoDB 연결
let conn = null;
const connectDB = async () => {
  if (conn == null) {
    console.log('Connecting to MongoDB...');
    try {
      conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('MongoDB connected successfully');
      await createInitialAdminAccount();
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
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
  try {
    await connectDB();
    const { name, password } = req.body;
    const employee = await Employee.findOne({ name });
    if (!employee) {
      return res.status(401).json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' });
    }
    const isMatch = await employee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' });
    }
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

// 작업 데이터 저장 라우트
router.post('/employee/work', async (req, res) => {
  try {
    await connectDB();
    const workData = req.body.workData;
    console.log("받은 작업 데이터:", workData);

    // 데이터의 날짜 확인 (첫 번째 항목의 날짜 사용)
    const dataDate = new Date(workData[0].date);
    const startOfDay = new Date(dataDate.getFullYear(), dataDate.getMonth(), dataDate.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // 같은 날짜의 기존 데이터 삭제
    await Work.deleteMany({
      date: { $gte: startOfDay, $lt: endOfDay }
    });

    // 새 데이터 저장
    const savedWork = await Work.insertMany(workData);
    console.log("저장된 작업 데이터:", savedWork);
    res.status(201).json(savedWork);
  } catch (error) {
    console.error('Error saving work data:', error);
    res.status(500).json({ error: '작업 데이터 저장에 실패했습니다.' });
  }
});

// 공지사항 관련 엔드포인트
router.get('/notices', async (req, res) => {
  try {
    const notices = await Notice.find().sort({ dateTime: -1 });
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: '공지사항 조회 중 오류가 발생했습니다.' });
  }
});

// 공지사항 등록
router.post('/notices', async (req, res) => {
  try {
    const { title, content } = req.body;
    const newNotice = new Notice({ title, content });
    const savedNotice = await newNotice.save();
    res.status(201).json(savedNotice);
  } catch (error) {
    res.status(500).json({ error: '공지사항 등록 중 오류가 발생했습니다.' });
  }
});

// 공지사항 수정
router.put('/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const updatedNotice = await Notice.findByIdAndUpdate(id, { title, content }, { new: true });
    if (!updatedNotice) {
      return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
    }
    res.json(updatedNotice);
  } catch (error) {
    res.status(500).json({ error: '공지사항 수정 중 오류가 발생했습니다.' });
  }
});

// 공지사항 삭제
router.delete('/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedNotice = await Notice.findByIdAndDelete(id);
    if (!deletedNotice) {
      return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
    }
    res.json({ message: '공지사항이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '공지사항 삭제 중 오류가 발생했습니다.' });
  }
});

// 비밀번호 변경 라우트
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
  try {
    await connectDB();
    const { date } = req.params;
    console.log('Received date for deletion:', date);

    // 날짜 범위 설정 (UTC 기준)
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    console.log('Deleting data between:', startOfDay, 'and', endOfDay);

    const result = await Work.deleteMany({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    console.log('Deletion result:', result);

    if (result.deletedCount > 0) {
      res.json({ message: `${date} 데이터가 삭제되었습니다. 삭제된 항목: ${result.deletedCount}` });
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

// 작업 데이터 불러오기 라우트 추가
router.get('/employee/work', async (req, res) => {
  try {
    await connectDB();
    const { employeeName, year, month } = req.query;
    console.log('Requested params:', { employeeName, year, month });

    let query = {};
    if (year && month) {
      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      query.date = { $gte: startDate, $lte: endDate };
    }
    if (employeeName && employeeName !== '') {
      query.employeeName = employeeName;
    }

    const workData = await Work.find(query).sort({ date: 1 });
    console.log('Found work data:', workData.length, 'records');

    res.json(workData);
  } catch (error) {
    console.error('Error fetching employee work data:', error);
    res.status(500).json({ error: '작업자 데이터를 가져오는 데 실패했습니다.' });
  }
});

// 작업자 목록 불러오기 라우트 추가
router.get('/employees', async (req, res) => {
  try {
    await connectDB();
    const employees = await Employee.find({});
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: '직원 정보를 가져오는 데 실패했습니다.' });
  }
});

// 작업자 추가 라우트 추가
router.post('/employees', async (req, res) => {
  try {
    await connectDB();
    const { name, employeeId, role, password, isInitialPassword } = req.body;
    const newEmployee = new Employee({
      name,
      employeeId,
      role,
      password,
      isInitialPassword
    });
    const savedEmployee = await newEmployee.save();
    res.status(201).json(savedEmployee);
  } catch (error) {
    console.error('Error adding employee:', error);
    res.status(500).json({ error: '작업자 추가에 실패했습니다.' });
  }
});

