require('dotenv').config();
console.log('MONGODB_URI:', process.env.MONGODB_URI);


const mongoose = require('mongoose');
const moment = require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");

const { Employee, initializeFields } = require('./models/employee');
const Work = require('./models/work');
const Notice = require('./models/notice');
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const webpush = require('web-push');
const EventEmitter = require('events');
const eventEmitter = new EventEmitter();
const LuckyShopItem = require('./models/LuckyShopItem');
const LuckyShopPurchase = require('./models/LuckyShopPurchase');
const FortuneLog = require('./models/fortuneLog');
const PointHistory = require('./models/pointHistory');
const AccountHistory = require('./models/accountHistory');

const prizeSchema = new mongoose.Schema({
  name: String,
  createdAt: { type: Date, default: Date.now }
});

const Prize = mongoose.model('Prize', prizeSchema);

const app = express();
app.use(express.static('public'));
const router = express.Router();

const getWorkerData = require('./getWorkerData');

// 그리고 라트 정의를 다음과 같이 수정하세요
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

const AccessLog = mongoose.model('AccessLog', new mongoose.Schema({
  groupNumber: String,
  employeeName: String,
  accessTime: { type: Date, default: Date.now },
  ipAddress: String
}));

// 로그인 라우트 수정
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

    // 접속 로그 저장
    const accessLog = new AccessLog({
      groupNumber: employee.groupNumber,
      employeeName: employee.name,
      ipAddress: req.ip
    });
    await accessLog.save();

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
    res.status(500).json({ error: '공지사항 조회 중 ���류가 발생했니다.' });
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
    res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
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

// 데이���베이스 초기화 라우트
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
  await initializeFields(); // 필드 초기화 호출
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

// 작업자 추가 우트 추가
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
      return res.status(404).json({ error: '작업를 찾을 수 없습니다.' });
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
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const onNewEvent = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  eventEmitter.on('newEvent', onNewEvent);

  req.on('close', () => {
    eventEmitter.removeListener('newEvent', onNewEvent);
    res.end();
  });

  // 연결 유지를 위한 주기적인 ping 전송
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(pingInterval);
  });
});

// 접속 기록 조회 라우트
router.get('/access-logs/:groupNumber', async (req, res) => {
  try {
    await connectDB();
    const { groupNumber } = req.params;
    const logs = await AccessLog.find({ groupNumber }).sort({ accessTime: -1 }).limit(50);
    res.json(logs);
  } catch (error) {
    console.error('접속 기록 조회 중 오류:', error);
    res.status(500).json({ error: '접속 기록 조회 중 오류가 발생했습니다.' });
  }
});

// Fortune 모델 선언
const fortuneSchema = new mongoose.Schema({
  content: String,
  // 필요한 다른 필드들을 여기에 추가하세요
});
const Fortune = mongoose.models.Fortune || mongoose.model('Fortune', fortuneSchema);

// 운세 문구 등록 API
router.post('/fortunes', async (req, res) => {
  try {
    const { content } = req.body;
    const newFortune = new Fortune({ content });
    await newFortune.save();
    res.status(201).json({ message: ' 문구가 등록되었습니다.', fortune: newFortune });
  } catch (error) {
    res.status(500).json({ error: '운세 문구 등록 중 오류가 발생했습니다.' });
  }
});

// 운세 문구 조회 API
router.get('/fortunes', async (req, res) => {
  try {
    const fortunes = await Fortune.find().sort({ createdAt: -1 });
    res.json(fortunes);
  } catch (error) {
    res.status(500).json({ error: '운세 문구 조회 중 오류가 발생했습니다.' });
  }
});

// 오늘의 운세 조회 API
router.get('/fortunelogs/:groupNumber', async (req, res) => {
  try {
    const { groupNumber } = req.params;
    const today = moment().tz("Asia/Seoul").startOf('day').toDate();
    today.setHours(0, 0, 0, 0);

    let fortuneLog = await FortuneLog.findOne({ groupNumber });
    
    if (!fortuneLog) {
      fortuneLog = new FortuneLog({ groupNumber, accumulatedScore: 0 });
    }

    const viewedToday = fortuneLog.lastCheckedAt && fortuneLog.lastCheckedAt >= today;

    res.json({
      content: fortuneLog.fortune,
      luckyScore: fortuneLog.luckyScore,
      accumulatedScore: fortuneLog.accumulatedScore,
      viewedToday: viewedToday,
      lastViewDate: fortuneLog.lastCheckedAt
    });
  } catch (error) {
    console.error('운세 로그 조회 중 오류:', error);
    res.status(500).json({ error: '운세 로그 조회 중 오류가 발생했습니다.' });
  }
});

// 운세 문구 업로드 API
router.post('/fortunes/upload', async (req, res) => {
  try {
    const { fortunes } = req.body;

    if (!fortunes || !Array.isArray(fortunes)) {
      return res.status(400).json({ error: '올바른 형식의 운세 데이터가 전송되지 않았습니다.' });
    }

    for (const content of fortunes) {
      const newFortune = new Fortune({ content });
      await newFortune.save();
    }

    res.status(201).json({ message: '운세가 성공적으로 업로드되었습니다.' });
  } catch (error) {
    console.error('운세 업로드 중 오류:', error);
    res.status(500).json({ error: '운세 업로드 중 오류가 발생했습니다.' });
  }
});

// 운세 삭제 API
router.delete('/fortunes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Fortune.findByIdAndDelete(id);
    res.json({ message: '운세가 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('운세 삭제 중 오류:', error);
    res.status(500).json({ error: '운세 삭제 중 오류가 발생했습니다.' });
  }
});

// 상품 목록 조회 API
router.get('/prizes', async (req, res) => {
  try {
    const prizes = await Prize.find();
    res.json(prizes);
  } catch (error) {
    console.error('상품 목록 조회 중 오류:', error);
    res.status(500).json({ error: '상품 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 상품 추가 API
router.post('/prizes', async (req, res) => {
  try {
    const { name } = req.body;
    const newPrize = new Prize({ name });
    await newPrize.save();
    res.status(201).json(newPrize);
  } catch (error) {
    console.error('상품 추가 중 오류:', error);
    res.status(500).json({ error: '상품 추가 중 오류가 발생했습니다.' });
  }
});

// 상품 삭제 API
router.delete('/prizes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Prize.findByIdAndDelete(id);
    res.json({ message: '상품이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('상품 삭제 중 오류:', error);
    res.status(500).json({ error: '상품 삭제 중 오류가 발생했습니다.' });
  }
});

// 사용 가능한 연도 목록 가져오기
router.get('/employee/work/years', async (req, res) => {
  try {
    await connectDB();
    const years = await Work.distinct('date', {}).then(dates => 
      [...new Set(dates.map(date => new Date(date).getUTCFullYear()))]
    );
    res.json(years.sort((a, b) => b - a));
  } catch (error) {
    console.error('연도 목록 조회 중 오류:', error);
    res.status(500).json({ error: '연도 목록을 가져오는 데 실패했습니다.' });
  }
});

// 특정 연도의 모든 작업 데이터 가져오기
router.get('/employee/work/all', async (req, res) => {
  try {
    await connectDB();
    const { year } = req.query;
    console.log('Requested year:', year);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(parseInt(year) + 1, 0, 1);
    console.log('Start date:', startDate, 'End date:', endDate);

    const works = await Work.find({
      date: { $gte: startDate, $lt: endDate }
    }).sort({ date: 1 });
    console.log('Number of works found:', works.length);

    const formattedData = works.reduce((acc, work) => {
      const monthKey = `${work.date.getUTCFullYear()}-${(work.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push({
        groupNumber: work.groupNumber,
        employeeName: work.employeeName,
        date: work.date,
        weight: work.weight,
        workHours: work.workHours
      });
      return acc;
    }, {});

    console.log('Formatted data:', JSON.stringify(formattedData, null, 2));
    res.json(formattedData);
  } catch (error) {
    console.error('작업 데이터 조회 중 오류:', error);
    res.status(500).json({ error: '작업 데이터를 가져오는 데 실패했습니다.' });
  }
});

// 랜덤 운세 제공 엔드포인트 추가
router.get('/fortunes/random', async (req, res) => {
  try {
    await connectDB();
    const count = await Fortune.countDocuments();
    const random = Math.floor(Math.random() * count);
    const fortune = await Fortune.findOne().skip(random);
    
    if (!fortune) {
      return res.status(404).json({ error: '운세를 찾을 수 없습니다.' });
    }
    
    res.json({ content: fortune.content });
  } catch (error) {
    console.error('랜덤 운세 조회 중 오류:', error);
    res.status(500).json({ error: '운세를 가져오는데 실패했습니다.' });
  }
});

// 구매 내역 조회
router.get('/lucky-shop-purchases', async (req, res) => {
  try {
    const purchases = await LuckyShopPurchase.find().sort({ purchaseDate: -1 });
    console.log('조회된 구매 내역:', purchases);
    res.json(purchases);
  } catch (error) {
    console.error('구매 내역 조회 중 오류:', error);
    res.status(500).json({ error: '구매 내역 조회 중 오류가 발생했습니다.' });
  }
});

// 구매 완료 처리
router.post('/lucky-shop-purchase-complete/:id', async (req, res) => {
  try {
    const purchase = await LuckyShopPurchase.findByIdAndUpdate(
      req.params.id,
      { 
        isDelivered: true,
        deliveryDate: new Date()
      },
      { new: true }
    );
    
    if (!purchase) {
      return res.status(404).json({ error: '구매 내역을 찾을 수 없습니다.' });
    }
    
    console.log('구매 완료 처리됨:', purchase);
    res.json(purchase);
  } catch (error) {
    console.error('구매 완료 처리 중 오류:', error);
    res.status(500).json({ error: '구매 완료 처리 중 오류가 발생했습니다.' });
  }
});

// 행운 상점 아이템 목록 조회
router.get('/lucky-shop-items', async (req, res) => {
  try {
    const items = await LuckyShopItem.find();
    res.json(items);
  } catch (error) {
    console.error('상품 목록 조회 중 오류:', error);
    res.status(500).json({ error: '상품 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 행운 상점 아이템 구매
router.post('/lucky-shop-purchase/:id', async (req, res) => {
  try {
    const { groupNumber } = req.body;
    const item = await LuckyShopItem.findById(req.params.id);
    const fortuneLog = await FortuneLog.findOne({ groupNumber });

    if (!item || !fortuneLog) {
      return res.status(404).json({ error: '상품 또는 사용자 정보를 찾을 수 없습��다.' });
    }

    if (fortuneLog.accumulatedScore < item.points) {
      return res.status(400).json({ error: '누적 점수가 부족합니다.' });
    }

    const oldScore = fortuneLog.accumulatedScore;
    fortuneLog.accumulatedScore -= item.points;
    await fortuneLog.save();

    const newPurchase = new LuckyShopPurchase({
      groupNumber,
      itemName: item.name
    });
    await newPurchase.save();

    // 포인트 변동 내역 저장
    await PointHistory.create({
      groupNumber,
      changeAmount: -item.points,
      reason: '행운상점구매',
      details: `${item.name} 구매 (${oldScore} → ${fortuneLog.accumulatedScore})`
    });

    res.json({ message: '구매가 완료되었습니다.', newScore: fortuneLog.accumulatedScore });
  } catch (error) {
    console.error('상품 구매 중 오류:', error);
    res.status(500).json({ error: '상품 구매 중 오류가 발생했습니다.' });
  }
});

// 운세 점수 생성 함수
function generateLuckyScore() {
  const rand = Math.random() * 100;
  if (rand < 0.0000001) return 100;
  if (rand < 0.0000005) return 95 + Math.floor(Math.random() * 5);
  if (rand < 0.0000010) return 90 + Math.floor(Math.random() * 5);
  if (rand < 0.0000020) return 80 + Math.floor(Math.random() * 10);
  if (rand < 0.0000120) return 70 + Math.floor(Math.random() * 10);
  if (rand < 0.0001120) return 60 + Math.floor(Math.random() * 10);
  if (rand < 0.0011120) return 50 + Math.floor(Math.random() * 10);
  if (rand < 0.0111120) return 30 + Math.floor(Math.random() * 20);
  if (rand < 0.1111120) return 10 + Math.floor(Math.random() * 20);
  if (rand < 0.6111120) return 4 + Math.floor(Math.random() * 6); // 0.5% 확률로 4-9점
  return 1 + Math.floor(Math.random() * 3); // 나머지 확률로 1-3점
}

router.post('/fortunelogs/use', async (req, res) => {
  try {
    const { groupNumber } = req.body;
    console.log('운세 요청 받음. groupNumber:', groupNumber);

    const count = await Fortune.countDocuments();
    if (count === 0) {
      return res.status(404).json({ error: '운세 데이터가 없습니다.' });
    }

    const random = Math.floor(Math.random() * count);
    const fortuneDoc = await Fortune.findOne().skip(random);

    if (!fortuneDoc) {
      return res.status(404).json({ error: '운세를 찾을 수 없습니다.' });
    }

    const luckyScore = generateLuckyScore();
    let fortuneLog = await FortuneLog.findOne({ groupNumber });
    
    if (!fortuneLog) {
      fortuneLog = new FortuneLog({ groupNumber, accumulatedScore: 0 });
    }
    
    const today = moment().tz("Asia/Seoul").startOf('day').toDate();
    today.setHours(0, 0, 0, 0);

    if (fortuneLog.lastCheckedAt && fortuneLog.lastCheckedAt >= today) {
      return res.status(400).json({ error: '오늘은 이미 운세를 확인하셨습니다.' });
    }

    const previousScore = fortuneLog.accumulatedScore;
    fortuneLog.accumulatedScore += luckyScore;
    fortuneLog.fortune = fortuneDoc.content;
    fortuneLog.luckyScore = luckyScore;
    fortuneLog.lastCheckedAt = new Date();
    
    await fortuneLog.save();

    console.log(`${groupNumber}의 누적 점수 업데이트:`, fortuneLog.accumulatedScore);

    // 포인트 변동 내역 저장
    await PointHistory.create({
      groupNumber,
      changeAmount: luckyScore,
      reason: '운세확인획득',
      details: `운세 확인으로 ${luckyScore} 포인트 획득 (${previousScore} → ${fortuneLog.accumulatedScore})`
    });

    res.json({
      content: fortuneDoc.content,
      luckyScore: luckyScore,
      accumulatedScore: fortuneLog.accumulatedScore
    });
  } catch (error) {
    console.error('운세 처리 중 오류:', error);
    res.status(500).json({ error: '운세 처리 중 오류가 발생했습니다.' });
  }
});

router.post('/fortune/use-secret/:groupNumber', async (req, res) => {
  try {
    const { groupNumber } = req.params;
    let fortuneLog = await FortuneLog.findOne({ groupNumber });
    
    if (!fortuneLog) {
      fortuneLog = new FortuneLog({ groupNumber, accumulatedScore: 0 });
    }
    
    // 시크릿 버튼 사용 시 추가 점수 (예: 50점)
    const secretBonus = 50;
    fortuneLog.accumulatedScore += secretBonus;
    await fortuneLog.save();

    res.json({ 
      message: '시크릿 버튼이 성공적으로 사용되었습니다.',
      accumulatedScore: fortuneLog.accumulatedScore 
    });
  } catch (error) {
    console.error('시크릿 버튼 처리 중 오류:', error);
    res.status(500).json({ error: '시크릿 버튼 처리 중 오류가 발생했습니다.' });
  }
});

router.get('/accumulated-scores', async (req, res) => {
  try {
    const fortuneLogs = await FortuneLog.find({});
    const accumulatedScores = {};
    fortuneLogs.forEach(log => {
      accumulatedScores[log.groupNumber] = log.accumulatedScore || 0;
    });
    res.json(accumulatedScores);
  } catch (error) {
    console.error('누적 점수 조회 중 오류:', error);
    res.status(500).json({ error: '누적 점수 조회 중 오류가 발생했습니다.' });
  }
});

router.put('/employee/:groupNumber', async (req, res) => {
  try {
    const { groupNumber } = req.params;
    const updates = req.body;

    const employee = await Employee.findOne({ groupNumber });
    if (!employee) {
      return res.status(404).json({ message: '직원을 찾을 수 없습니다.' });
    }

    // 업데이트할 필드가 있는 경우
    await employee.updateInfo(updates); // updateInfo 메서드를 사용하여 업데이트

    res.status(200).json({ success: true, message: '직원 정보가 업데이트되었습니다.' });
  } catch (error) {
    console.error('직원 정보 업데이트 중 오류 발생:', error);
    res.status(500).json({ error: '직원 정보 업데이트에 실패했습니다.' });
  }
});

router.put('/lucky-shop-items/:id', async (req, res) => {
  try {
    const { name, points } = req.body;
    const updatedItem = await LuckyShopItem.findByIdAndUpdate(
      req.params.id,
      { name, points },
      { new: true }
    );
    res.json(updatedItem);
  } catch (error) {
    console.error('상품 수정 중 오류:', error);
    res.status(500).json({ error: '상품 수정 중 오류가 발생했습니다.' });
  }
});

router.delete('/lucky-shop-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedItem = await LuckyShopItem.findByIdAndDelete(id);
    if (!deletedItem) {
      return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
    }
    res.json({ message: '상품이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('상품 삭제 중 오류:', error);
    res.status(500).json({ error: '상품 삭제 중 오류가 발생했습니다.' });
  }
});

router.post('/lucky-shop-items', async (req, res) => {
  try {
    const { name, points } = req.body;
    const newItem = new LuckyShopItem({ name, points });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (error) {
    console.error('상품 추가 중 오류:', error);
    res.status(500).json({ error: '상품 추가 중 오류가 발생했습니다.' });
  }
});

// 누적 점수 수정 라우트
router.put('/accumulated-score/:groupNumber', async (req, res) => {
  try {
    const { groupNumber } = req.params;
    const { score } = req.body;
    
    const fortuneLog = await FortuneLog.findOne({ groupNumber });
    if (!fortuneLog) {
      return res.status(404).json({ error: '해당 작업자의 기록을 찾을 수 없습니다.' });
    }

    const oldScore = fortuneLog.accumulatedScore;
    
    // 점수 변경 및 저장
    fortuneLog.accumulatedScore = score;
    await fortuneLog.save();

    // 포인트 변동 내역 저장 (관리자 변경으로만 기록)
    await PointHistory.create({
      groupNumber,
      changeAmount: score - oldScore,
      reason: '관리자변경',
      details: `관리자에 의한 점수 변경 (${oldScore} → ${score})`
    });

    res.json({ success: true, message: '누적 점수가 성공적으로 수정되었습니다.' });
  } catch (error) {
    console.error('누적 점수 수정 중 오류:', error);
    res.status(500).json({ error: '누적 점수 수정 중 오류가 발생했습니다.' });
  }
});

// 포인트 변동 내역 저장 엔드포인트
router.post('/point-history', async (req, res) => {
  try {
    const { groupNumber, changeAmount, reason, details } = req.body;

    const newPointHistory = new PointHistory({
      groupNumber,
      changeAmount,
      reason,
      details
    });

    await newPointHistory.save();

    res.status(201).json({ message: '포인트 변동 내역이 저장되었습니다.', pointHistory: newPointHistory });
  } catch (error) {
    console.error('포인트 변동 내역 저장 중 오류:', error);
    res.status(500).json({ error: '포인트 변동 내역 저장 중 오류가 발생했습니다.' });
  }
});

// 포인트 변동 내역 조회 엔드포인트
router.get('/point-history/:groupNumber', async (req, res) => {
  try {
    const { groupNumber } = req.params;
    const pointHistory = await PointHistory.find({ groupNumber }).sort({ timestamp: -1 });
    res.json(pointHistory);
  } catch (error) {
    console.error('포인트 변동 내역 조회 중 오류:', error);
    res.status(500).json({ error: '포인트 변동 내역 조회 중 오류가 발생했습니다.' });
  }
});

// 새로운 스키마 정의
const monthlyWorkerSummarySchema = new mongoose.Schema({
  groupNumber: String,
  year: Number,
  month: Number,
  totalWeight: Number,
  totalPayment: Number
});

const MonthlyWorkerSummary = mongoose.model('MonthlyWorkerSummary', monthlyWorkerSummarySchema);

// 월별 요약 데이터 생성 함수
const createMonthlySummary = async () => {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const summaries = await Work.aggregate([
    {
      $match: {
        date: { $gte: startOfLastMonth, $lte: endOfLastMonth }
      }
    },
    {
      $group: {
        _id: "$groupNumber",
        totalWeight: { $sum: "$weight" },
        totalPayment: { $sum: "$payment" }
      }
    }
  ]);

  for (const summary of summaries) {
    await MonthlyWorkerSummary.findOneAndUpdate(
      { 
        groupNumber: summary._id, 
        year: lastMonth.getFullYear(), 
        month: lastMonth.getMonth() + 1 
      },
      {
        totalWeight: summary.totalWeight,
        totalPayment: summary.totalPayment
      },
      { upsert: true, new: true }
    );
  }
};

// 매일 자정에 실행되는 스케줄러 설정
const schedule = require('node-schedule');
schedule.scheduleJob('0 0 * * *', createMonthlySummary);

// 지난달 요약 데이터 조회 엔드포인트
router.get('/last-month-summary/:groupNumber', async (req, res) => {
  try {
    await connectDB();
    const { groupNumber } = req.params;
    const now = new Date();
    
    // 11일 이후면 데이터를 제공하지 않음
    if (now.getDate() > 11) {
      return res.status(403).json({ message: "지난달 데이터를 더 이상 조회할 수 없습니다." });
    }

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const summary = await Work.aggregate([
      {
        $match: {
          groupNumber: groupNumber,
          date: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalWeight: { $sum: "$weight" },
          totalPayment: { $sum: "$payment" }
        }
      }
    ]);

    if (summary.length === 0) {
      return res.status(404).json({ message: "지난달 데이터가 없습니다." });
    }

    res.json({
      totalWeight: summary[0].totalWeight,
      totalPayment: summary[0].totalPayment
    });
  } catch (error) {
    console.error('지난달 요약 데이터 조회 중 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 이력 저장을 위한 API
router.post('/account-history', async (req, res) => {
  try {
    const { groupNumber, oldAccountNumber, newAccountNumber, reason } = req.body;

    const historyEntry = new AccountHistory({
      groupNumber,
      oldAccountNumber,
      newAccountNumber,
      reason,
      date: new Date()
    });

    await historyEntry.save();
    res.status(201).json({ success: true, message: '이력이 저장되었습니다.' });
  } catch (error) {
    console.error('이력 저장 중 오류 발생:', error);
    res.status(500).json({ error: '이력 저장에 실패했습니다.' });
  }
});

// 계좌번호 변경 이력 가져오기
router.get('/account-history/:groupNumber', async (req, res) => {
  try {
    const { groupNumber } = req.params;
    const history = await AccountHistory.find({ groupNumber }).sort({ date: -1 }); // 최신 순으로 정렬
    res.status(200).json(history);
  } catch (error) {
    console.error('이력 가져오기 중 오류 발생:', error);
    res.status(500).json({ error: '이력 가져오기 실패' });
  }
});

// 계좌번호 확인 상태 업데이트
router.put('/employee/check-account-number/:groupNumber', async (req, res) => {
  try {
    const { groupNumber } = req.params;
    const employee = await Employee.findOne({ groupNumber });
    if (!employee) {
      return res.status(404).json({ message: '직원을 찾을 수 없습니다.' });
    }

    // 계좌번호 확인 상태 업데이트
    employee.isAccountNumberChecked = true; // true로 설정
    await employee.save(); // 데이터베이스에 저장

    res.status(200).json({ success: true, message: '계좌번호 확인 상태가 업데이트되었습니다.' });
  } catch (error) {
    console.error('계좌번호 확인 상태 업데이트 중 오류 발생:', error);
    res.status(500).json({ error: '계좌번호 확인 상태 업데이트에 실패했습니다.' });
  }
});

// 계좌번호 변경 이력 삭제 API
router.delete('/account-history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await AccountHistory.findByIdAndDelete(id); // ID로 이력 삭제

    if (!result) {
      return res.status(404).json({ message: '이력을 찾을 수 없습니다.' });
    }

    res.status(200).json({ success: true, message: '이력이 삭제되었습니다.' });
  } catch (error) {
    console.error('이력 삭제 중 오류 발생:', error);
    res.status(500).json({ error: '이력 삭제에 실패했습니다.' });
  }
});