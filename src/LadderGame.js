import React, { useState } from "react";
import "./RouletteGame.css";

const RouletteGame = () => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);

  const segments = [
    "1번 당첨!",
    "2번 당첨!",
    "3번 당첨!",
    "4번 당첨!",
    "5번 당첨!",
    "6번 당첨!",
  ];

  const startSpin = () => {
    if (spinning) return;

    setSpinning(true);
    setResult(null); // 이전 결과 초기화

    // 랜덤 회전 각도 (360도 * N + 보정 각도)
    const randomSpin = Math.floor(Math.random() * 360) + 360 * 5; // 최소 5바퀴
    const totalRotation = rotation + randomSpin;

    // 회전 각도 설정
    setRotation(totalRotation);

    // 4초 후에 결과 표시
    setTimeout(() => {
      const segmentAngle = 360 / segments.length; // 각 섹션의 각도 (60도)
      const adjustedRotation = totalRotation % 360; // 회전이 멈춘 후의 각도
      const resultIndex = Math.floor((360 - adjustedRotation) / segmentAngle) % segments.length; // 12시 방향에서부터의 위치 계산

      setResult(segments[resultIndex]);
      setSpinning(false);
    }, 4000);
  };

  return (
    <div className="roulette-container">
      <h1>Roulette Game</h1>
      {/* 룰렛 화살표 */}
      <div className="arrow"></div>
      <div className="roulette-wheel" style={{ transform: `rotate(${rotation}deg)` }}>
        {segments.map((segment, index) => (
          <div key={index} className={`roulette-segment segment-${index}`} style={{ transform: `rotate(${index * 60}deg)` }}>
            <span>{segment}</span>
          </div>
        ))}
      </div>
      <button className="spin-button" onClick={startSpin} disabled={spinning}>
        돌리기
      </button>

      {result && <div className="result">결과: {result}</div>}
    </div>
  );
};

export default RouletteGame;
