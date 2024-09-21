const mongoose = require('mongoose');
const Work = require('./models/work'); // Work 모델 경로를 정확히 지정하세요

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // MongoDB 연결 (연결 문자열은 환경 변수로 설정해야 합니다)
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,                      
        useUnifiedTopology: true,
      });
    }

    const { username } = event.queryStringParameters;
    const workerData = await Work.find({ employeeName: username }).sort({ date: -1 });

    return {
      statusCode: 200,
      body: JSON.stringify(workerData),
    };
  } catch (error) {
    console.error('작업자 데이터 조회 중 오류:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: '서버 오류' }),
    };
  }
};
