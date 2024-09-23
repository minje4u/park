require('dotenv').config();
console.log('MONGODB_URI:', process.env.MONGODB_URI);

const mongoose = require('mongoose');
const Employee = require('./models/employee');
const Work = require('./models/work');
const Notice = require('./models/notice');
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const webpush = require('web-push');
const EventEmitter = require('events');
const eventEmitter = new EventEmitter();

const app = express();
app.use(express.static('public'));
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
        useUnifiedTopology: true,
        dbName: 'myDatabase'
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
        name: '관리자',
        groupNumber: 'admin',
        password: '0000',
        role: 'admin',
        isInitialPassword: true
      });
      await newAdmin.save();
      console.log('초기 관리자 계정이 생성되었습니다.');
    } else {
      console.log('관리자 계정이 이미 존재합니다.');
    }
    await updateMissingGroupNumbers();
  } catch (error) {
    console.error('초기 관리자 계정 생성 중 오류 발생:', error);
  }
};

const generateGroupNumber = (조, employeeId) => {
  const paddedId = employeeId.toString().padStart(2, '0');
  return `${조}-${paddedId}`;
};

const updateMissingGroupNumbers = async () => {
  try {
    const works = await Work.find({ groupNumber: { $exists: false } });
    for (let work of works) {
      work.groupNumber = generateGroupNumber(work.조, work.employeeId);
      await work.save();
    }
    console.log(`${works.length}개의 작업 데이터에 groupNumber가 추가되었습니다.`);
  } catch (error) {
    console.error('Error updating missing group numbers:', error);
  }
};

// 로그인 라우트
router.post('/login', async (req, res) => {
  try {
    await connectDB();
    const { groupNumber, password } = req.body;
    const employee = await Employee.findOne({ groupNumber });
    if (!employee) {
      return res.status(401).json({ error: '조판번호 또는 비밀번호가 올바르지 않습니다.' });
    }
    const isMatch = await employee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: '조판번호 또는 비밀번호가 올바르지 않습니다.' });
    }
    res.json({ 
      name: employee.name, 
      groupNumber: employee.groupNumber,
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
    const { workData, overwrite } = req.body;
    console.log("받은 작업 데이터:", workData);

    // groupNumber가 없는 데이터 필터링
    const invalidData = workData.filter(item => !item.groupNumber);
    if (invalidData.length > 0) {
      return res.status(400).json({ error: 'Some data is missing groupNumber', invalidData });
    }

    if (overwrite) {
      // 해당 날짜의 기존 데이터 삭제
      const date = new Date(workData[0].date);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      await Work.deleteMany({ date: { $gte: startOfDay, $lt: endOfDay } });
    } else {
      // 중복 데이터 처리
      for (const work of workData) {
        const existingWork = await Work.findOne({
          date: work.date,
          groupNumber: work.groupNumber
        });
        if (existingWork) {
          existingWork.weight = Math.max(existingWork.weight, work.weight);
          existingWork.workHours = Math.max(existingWork.workHours, work.workHours);
          await existingWork.save();
        } else {
          await Work.create(work);
        }
      }
      return res.status(201).json({ message: '작업 데이터가 성공적으로 저장되었습니다.' });
    }

    const savedWork = await Work.insertMany(workData);
    console.log("저장된 작업 데이터:", savedWork);
    eventEmitter.emit('newEvent', { type: 'work', data: savedWork });
    res.status(201).json(savedWork);
  } catch (error) {
    console.error('Error saving work data:', error);
    console.error('Error details:', error.message);
    if (error.stack) console.error('Error stack:', error.stack);
    res.status(500).json({ error: '작업 데이터 저장에 실패했습니다.', details: error.message });
  }
});

// 특정 날짜의 작업 데이터 존재 여부 확인
router.get('/employee/work/check/:date', async (req, res) => {
  try {
    await connectDB();
    const { date } = req.params;
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existingData = await Work.findOne({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    res.json({ exists: !!existingData });
  } catch (error) {
    console.error('작업 데이터 확인 중 오류:', error);
    res.status(500).json({ error: '작업 데이터 확인 중 오류가 발생했습니다.' });
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
    eventEmitter.emit('newEvent', { type: 'notice', data: savedNotice });
    sendNotification({ title: '새 공지사항', body: title });
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
    await connectDB();
    const { groupNumber, newPassword } = req.body;
    const employee = await Employee.findOne({ groupNumber });
    if (!employee) {
      return res.status(404).json({ error: '작업자를 찾을 수 없습니다.' });
    }
    employee.password = newPassword;
    employee.isInitialPassword = false;
    await employee.save();
    res.json({ message: '비밀번호가 성공적으 변경되었습니다.' });
  } catch (error) {
    console.error('비밀번호 변경 중 오류:', error);
    res.status(500).json({ error: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
});

// 작업자 삭제
router.delete('/employees/:groupNumber', async (req, res) => {
  try {
    const { groupNumber } = req.params;
    const result = await Employee.findOneAndDelete({ groupNumber });
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
connectDB().then(async () => {
  console.log('서버가 시작되었습니다.');
  try {
    const works = await Work.find({ groupNumber: { $exists: false } });
    
    let updatedCount = 0;
    for (let work of works) {
      work.groupNumber = `${work.조}-${work.employeeId.toString().padStart(2, '0')}`;
      await work.save();
      updatedCount++;
    }

    console.log(`${updatedCount}개의 작업 데이터에 groupNumber가 추가되었습니다.`);
  } catch (error) {
    console.error('groupNumber 업데이트 중 오류 발생:', error);
  }
}).catch(err => {
  console.error('서버 시작 중 오류 발생:', err);
});

const handler = serverless(app);
module.exports = { handler };

// 작업 데이터 불러오기 라우트 추가
router.get('/employee/work', async (req, res) => {
  try {
    await connectDB();
    const { year, month, groupNumber } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required' });
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    
    let query = {
      date: { $gte: startDate, $lte: endDate }
    };

    if (groupNumber) {
      query.groupNumber = groupNumber;
    }

    const workData = await Work.find(query).sort({ date: 1 });

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
    const { name, groupNumber, role, password, isInitialPassword } = req.body;

    // 중복 검사
    const existingEmployee = await Employee.findOne({ groupNumber });
    if (existingEmployee) {
      return res.status(400).json({ error: '이미 존재하는 조판번호입니다.' });
    }

    const newEmployee = new Employee({
      name,
      groupNumber,
      role,
      password,
      isInitialPassword
    });
    const savedEmployee = await newEmployee.save();
    res.status(201).json(savedEmployee);
  } catch (error) {
    console.error('Error adding employee:', error);
    res.status(500).json({ error: '작업자 추가에 실패했습니다.', details: error.message });
  }
});

// 작업자 이름 수정
router.put('/employee/name/:groupNumber', async (req, res) => {
  try {
    await connectDB();
    const { groupNumber } = req.params;
    const { newName } = req.body;

    const work = await Work.findOne({ groupNumber });
    const employee = await Employee.findOne({ groupNumber });

    if (!work && !employee) {
      return res.status(404).json({ success: false, message: '해당 조판번호의 작업자를 찾을 수 없습니다.' });
    }

    if (work) {
      work.employeeName = newName;
      await work.save();
    }

    if (employee) {
      employee.name = newName;
      await employee.save();
    }

    res.json({ success: true, message: '이름이 성공적으로 수정었습니다.' });
  } catch (error) {
    console.error('이름 수정 중 오류:', error);
    res.status(500).json({ success: false, message: '이름 수정에 실패했습니다.' });
  }
});

router.post('/update-group-numbers', async (req, res) => {
  try {
    await connectDB();
    const works = await Work.find({ groupNumber: { $exists: false } });
    
    let updatedCount = 0;
    for (let work of works) {
      work.groupNumber = `${work.조}-${work.employeeId.toString().padStart(2, '0')}`;
      await work.save();
      updatedCount++;
    }

    res.status(200).json({ message: `${updatedCount}개의 작업 데이터에 groupNumber가 추가되었습니다.` });
  } catch (error) {
    console.error('Error updating group numbers:', error);
    res.status(500).json({ error: 'groupNumber 업데이트에 실패했습니다.' });
  }
});

router.get('/employee/:groupNumber', async (req, res) => {
  try {
    await connectDB();
    const { groupNumber } = req.params;
    const employee = await Employee.findOne({ groupNumber });
    if (!employee) {
      return res.status(404).json({ error: '작업자를 찾을 수 없습니다.' });
    }
    res.json({ name: employee.name });
  } catch (error) {
    console.error('Error fetching employee name:', error);
    res.status(500).json({ error: '작업자 정보를 가져오는 데 실패했습니다.' });
  }
});

webpush.setVapidDetails(
  'mailto:minje4u@gmail.com',
  process.env.REACT_APP_PUBLIC_VAPID_KEY,
  process.env.PRIVATE_VAPID_KEY
);

const subscriptions = [];

router.post('/subscribe', (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  res.status(201).json({});
});

const sendNotification = (message) => {
  subscriptions.forEach(subscription => {
    webpush.sendNotification(subscription, JSON.stringify(message))
      .catch(error => {
        console.error('Error sending notification:', error);
        console.error('Error details:', error.message);
        if (error.stack) console.error('Error stack:', error.stack);
      });
  });
};

// SSE 엔드포인트 추가
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onNewEvent = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  eventEmitter.on('newEvent', onNewEvent);

  req.on('close', () => {
    eventEmitter.removeListener('newEvent', onNewEvent);
  });
});

