const mongoose = require('mongoose');
const Employee = require('./models/Employee');
const Work = require('./models/work');
const Notice = require('./models/Notice');

let conn = null;

const connectDB = async () => {
  if (conn == null) {
    conn = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    await conn;
  }
  return conn;
};

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // CORS 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  const { path } = event;
  const body = JSON.parse(event.body);

  try {
    await connectDB();

    if (path === '/api/login') {
      // 로그인 로직
      const { name, password } = body;
      const employee = await Employee.findOne({ name });
      if (!employee || !await employee.comparePassword(password)) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: '이름 또는 비밀번호가 올바르지 않습니다.' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ name: employee.name, role: employee.role }) };
    }

    // 다른 API 엔드포인트들도 여기에 추가...

  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '서버 오류가 발생했습니다.' }) };
  }
};
