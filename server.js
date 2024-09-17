const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const app = express();

const Work = require("./models/work");
const Employee = require("./models/Employee");
const Notice = require("./models/Notice");


// 운세 목록
const fortunes = [
  "오늘은 행운의 날! 작업 능률이 최고조에 달할 거예요.",
  "조금만 더 노력하면 큰 성과가 있을 거예요.",
  "동료와의 협력이 오늘의 성공 비결입니다.",
  "새로운 아이디어가 떠오를 거예요. 메모해두세요!",
  "오늘은 안전에 특히 주의하세요. 건강이 최고의 재산입니다.",
  "긍정적인 마인드가 행운을 부릅니다. 힘내세요!",
  "작은 실수에 연연하지 마세요. 전체적으로 좋은 날입니다.",
  "오늘의 노력이 미래의 큰 보상으로 돌아올 거예요.",
  "동료의 작은 칭찬이 큰 힘이 될 거예요. 서로 격려해보세요.",
  "꾸준함이 실력입니다. 오늘도 한 걸음 성장하고 있어요."
];

// Fortune 스키마 정의
const fortuneSchema = new mongoose.Schema({
  username: String,
  date: String,
  fortune: String
});

const Fortune = mongoose.model('Fortune', fortuneSchema);

// 운세 상태 확인 API
app.get('/api/fortune-status/:username', async (req, res) => {
  const { username } = req.params;
  const today = new Date().toDateString();
  
  try {
    const userFortune = await Fortune.findOne({ username, date: today });
    if (userFortune) {
      res.json({ clicked: true, fortune: userFortune.fortune });
    } else {
      res.json({ clicked: false });
    }
  } catch (error) {
    console.error('운세 상태 확인 중 오류 발생:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 운세 가져오기 API
app.post('/api/get-fortune/:username', async (req, res) => {
  const { username } = req.params;
  const today = new Date().toDateString();
  
  try {
    let userFortune = await Fortune.findOne({ username, date: today });
    if (!userFortune) {
      const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
      userFortune = new Fortune({ username, date: today, fortune: randomFortune });
      await userFortune.save();
    }
    res.json({ fortune: userFortune.fortune });
  } catch (error) {
    console.error('운세 가져오기 중 오류 발생:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 미들웨어 설정
app.use(cors({
  origin: 'https://minje4u.github.io',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// 초기 관리자 계정 생성 함수
async function createInitialAdminAccount() {
  try {
    const adminExists = await Employee.findOne({ role: 'admin' });
    if (!adminExists) {
      const adminAccount = new Employee({
        name: 'admin',
        employeeId: 'ADMIN001',
        password: '0000',
        role: 'admin',
        isInitialPassword: true
      });
      await adminAccount.save();
      console.log('초기 관리자 계정이 생성되었습니다.');
    } else {
      console.log('관리자 계정이 이미 존재합니다.');
    }
  } catch (error) {
    console.error('초기 관리자 계정 생성 중 오류 발생:', error);
  }
}

// 비밀번호 재설정 코드 생성 및 저장 함수
async function generateResetCode(employeeId) {
  const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6자리 코드
  const employee = await Employee.findOne({ employeeId });
  if (employee) {
    employee.resetCode = resetCode;
    employee.resetCodeExpires = Date.now() + 3600000; // 1시간 후 만료
    await employee.save();
    return resetCode;
  }
  return null;
}

// MongoDB 연결
mongoose.connect("mongodb+srv://park:1234@cluster0.defae.mongodb.net/myDatabase?retryWrites=true&w=majority")
  .then(() => {
    console.log("MongoDB에 연결되었습니다.");
    createInitialAdminAccount();
  })
  .catch(err => console.log("MongoDB 연결 오류: ", err));

// 라우트 정의
// 비밀번호 재설정 요청
app.post("/api/reset-password-request", async (req, res) => {
  const { employeeId } = req.body;
  try {
    const resetCode = await generateResetCode(employeeId);
    if (resetCode) {
      // 여기서 실제로는 이메일이나 SMS로 코드를 전송해야 합니다.
      // 테스트를 위해 콘솔에 출력합니다.
      console.log(`Reset code for ${employeeId}: ${resetCode}`);
      res.json({ message: "비밀번호 재설정 코드가 생성되었습니다." });
    } else {
      res.status(404).json({ error: "해당 직원을 찾을 수 없습니다." });
    }
  } catch (error) {
    console.error('비밀번호 재설정 코드 생성 중 오류:', error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// 비밀번호 재설정
app.post("/api/reset-password", async (req, res) => {
  const { employeeId, resetCode, newPassword } = req.body;
  try {
    const employee = await Employee.findOne({
      employeeId,
      resetCode,
      resetCodeExpires: { $gt: Date.now() }
    });
    if (employee) {
      employee.password = newPassword;
      employee.resetCode = undefined;
      employee.resetCodeExpires = undefined;
      employee.isInitialPassword = false;
      await employee.save();
      res.json({ message: "비밀번호가 성공적으로 재설정되었습니다." });
    } else {
      res.status(400).json({ error: "유효하지 않은 재설정 코드입니다." });
    }
  } catch (error) {
    console.error('비밀번호 재설정 중 오류:', error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// 직원 관련 라우트
app.post("/api/employees", async (req, res) => {
  try {
    const { name, employeeId, password, role } = req.body;
    console.log('받은 데이터:', { name, employeeId, role }); // 비밀번호는 로그에 남기지 않습니다.

    // 중복 검사
    const existingEmployee = await Employee.findOne({ $or: [{ name }, { employeeId }] });
    if (existingEmployee) {
      return res.status(400).json({ error: '이미 존재하는 이름 또는 ID입니다.' });
    }

    const newEmployee = new Employee({ 
      name, 
      employeeId, 
      password, 
      role,
      isInitialPassword: true // 초기 비밀번호임을 표시
    });
    await newEmployee.save();

    console.log('새 직원 추가됨:', newEmployee);
    res.status(201).json({ message: "직원이 성공적으로 추가되었습니다." });
  } catch (error) {
    console.error('직원 추가 중 오류:', error);
    res.status(500).json({ error: '직원 추가 중 오류가 발생했습니다.' });
  }
});

app.get("/api/employees", async (req, res) => {
  try {
    const employees = await Employee.find({}, '-password');
    res.json(employees);
  } catch (error) {
    console.error('직원 목록 조회 중 오류:', error);
    res.status(500).json({ error: '직원 목록 조회 중 오류가 발생했습니다.' });
  }
});

app.delete("/api/employees/:id", async (req, res) => {
  try {
    const result = await Employee.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '해당 직원을 찾을 수 없습니다.' });
    }
    res.json({ message: "직원이 성공적으로 삭제되었습니다." });
  } catch (error) {
    console.error('직원 삭제 중 오류:', error);
    res.status(500).json({ error: '직원 삭제 중 오류가 발생했습니다.' });
  }
});

// 로그인
app.post("/api/login", async (req, res) => {
  try {
    const { name, password } = req.body;
    console.log('Login attempt:', { name, password: '****' }); // 비밀번호는 로그에 남기지 않습니다.

    const employee = await Employee.findOne({ name });
    if (!employee) {
      console.log('Employee not found');
      return res.status(401).json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' });
    }

    const isMatch = await employee.comparePassword(password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ error: '이름 또는 비밀번호가 올바르지 않습니다.' });
    }

    res.json({ name: employee.name, role: employee.role });
  } catch (error) {
    console.error('로그인 중 오류:', error);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 비밀번호 변경
app.post("/api/change-password", async (req, res) => {
  try {
    const { name, newPassword } = req.body;
    const employee = await Employee.findOne({ name });
    if (!employee) {
      return res.status(404).json({ error: '직원을 찾을 수 없습니다.' });
    }
    employee.password = newPassword;
    employee.isInitialPassword = false; // 초기 비밀번호가 아님을 표시
    await employee.save();
    res.json({ message: "비밀번호가 성공적으로 변경되었습니다." });
  } catch (error) {
    console.error('비밀번호 변경 중 오류:', error);
    res.status(500).json({ error: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
});

// 작업 관련 라우트
app.post("/api/employee/work", async (req, res) => {
  try {
    const { date, workData } = req.body;
    console.log("받은 데이터:", { date, workData }); // 로그 확인

    const savedWorks = [];

    for (const work of workData) {
      const newWork = new Work({
        date: new Date(date),
        조: work.조,
        employeeId: work.employeeId,
        employeeName: work.employeeName,
        weight: work.weight,
        workHours: work.workHours,
        totalWeight: work.totalWeight,
        payment: work.payment
      });

      console.log("저장할 작업 데이터:", newWork); // 로그 확인

      const savedWork = await newWork.save();
      savedWorks.push(savedWork);
    }

    console.log("저장된 데이터:", savedWorks); // 로그 확인
    res.status(201).json(savedWorks);
  } catch (error) {
    console.error('작업 데이터 저장 중 오류:', error);
    res.status(500).json({ error: '작업 데이터 저장 중 오류가 발생했습니다.' });
  }
});

app.get("/api/employee/work", async (req, res) => {
  try {
    const { year, month } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const works = await Work.find({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    });
    res.json(works);
  } catch (error) {
    console.error("작업 데이터 조회 중 오류 발생:", error);
    res.status(500).json({ error: "작업 데이터 조회 중 오류가 발생했습니다." });
  }
});

app.delete("/api/reset-database", async (req, res) => {
  try {
    await Work.deleteMany({});
    res.json({ message: "데이터베이스가 성공적으로 초기화되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "데이터베이스 초기화 중 오류가 발생했습니다." });
  }
});

app.delete("/api/employee/work/:date", async (req, res) => {
  try {
    const dateToDelete = new Date(req.params.date);
    const startOfDay = new Date(dateToDelete.setHours(0, 0, 0, 0));
    const endOfDay = new Date(dateToDelete.setHours(23, 59, 59, 999));

    const result = await Work.deleteMany({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    console.log(`${result.deletedCount}개의 문서가 삭제되었습니다.`);
    res.json({ message: `${result.deletedCount}개의 문서가 삭제되었습니다.` });
  } catch (error) {
    console.error('데이터 삭제 중 오류 발생:', error);
    res.status(500).json({ error: '데이터 삭제 중 오류가 발생했습니다.' });
  }
});

app.get('/api/worker/:username', async (req, res) => {
  const { username } = req.params;
  console.log('Received request for username:', username);
  
  try {
    const employee = await Employee.findOne({ name: username });
    console.log('Found employee:', employee);
    if (!employee) {
      console.log('Employee not found');
      return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
    }

    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const works = await Work.find({
      employeeName: username,
      date: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    }).sort({ date: 1 });

    const workerData = works.map(work => ({
      날짜: work.date.toISOString().split('T')[0],
      중량: work.weight,
      작업시간: work.workHours,
      도급비: work.payment
    }));

    console.log('Worker data:', workerData); // 로그 추가
    res.json(workerData);
  } catch (error) {
    console.error('작업자 데이터 조회 중 오류:', error);
    res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});

// 공지사항 등록 라우트
app.post('/api/notices', async (req, res) => {
  console.log('공지사항 등록 요청 받음:', req.body); // 로그 추가
  try {
    const { title, content } = req.body;
    const newNotice = new Notice({
      title,
      content,
      dateTime: new Date()
    });
    const savedNotice = await newNotice.save();
    console.log('공지사항 저장 성공:', savedNotice); // 로그 추가
    res.status(201).json(savedNotice);
  } catch (error) {
    console.error('공지사항 등록 중 오류 발생:', error); // 로그 추가
    res.status(500).json({ error: '공지사항 등록 중 오류가 발생했습니다.' });
  }
});

// 공지사항 조회 라우트 (수정)
app.get('/api/notices', async (req, res) => {
  console.log('공지사항 조회 요청 받음');
  try {
    const notices = await Notice.find().sort({ dateTime: -1 });
    console.log('조회된 공지사항:', notices);
    res.json(notices);
  } catch (error) {
    console.error('공지사항 조회 중 오류:', error);
    res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});


// 공지사항 삭제 라우트
app.delete('/api/notices/:id', async (req, res) => {
  console.log('공지사항 삭제 요청 받음:', req.params.id);
  try {
    const result = await Notice.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '해당 공지사항을 찾을 수 없습니다.' });
    }
    console.log('공지사항 삭제 성공');
    res.json({ message: "공지사항이 성공적으로 삭제되었습니다." });
  } catch (error) {
    console.error('공지사항 삭제 중 오류 발생:', error);
    res.status(500).json({ error: '공지사항 삭제 중 오류가 발생했습니다.' });
  }
});

// 공지사항 수정 라우트
app.put('/api/notices/:id', async (req, res) => {
  console.log('공지사항 수정 요청 받음:', req.params.id, req.body);
  try {
    const { title, content } = req.body;
    const updatedNotice = await Notice.findByIdAndUpdate(
      req.params.id,
      { title, content, dateTime: new Date() },
      { new: true }
    );
    if (!updatedNotice) {
      return res.status(404).json({ error: '해당 공지사항을 찾을 수 없습니다.' });
    }
    console.log('공지사항 수정 성공:', updatedNotice);
    res.json(updatedNotice);
  } catch (error) {
    console.error('공지사항 수정 중 오류 발생:', error);
    res.status(500).json({ error: '공지사항 수정 중 오류가 발생했습니다.' });
  }
});

// 서버 시작
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`));
