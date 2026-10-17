# 방 배치 플래너 (59B)

## 실행
### 백엔드
    cd backend
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=sk-ant-...      # Windows: set ANTHROPIC_API_KEY=...
    uvicorn main:app --reload --port 8000
(모델 변경: CLAUDE_MODEL 환경변수)

### 프론트
    cd frontend
    npm install
    npm run dev      # http://localhost:5173

## 흐름
도면 → 방 클릭 → 가구 추가/요구사항 입력 → 결과 불러오기 → A/B/C 중 선택 → 편집으로 복귀(선택안 기준으로 재생성)

## 치수 수정
backend/rooms.json — 단위 mm, 방 좌상단 원점.
obstacles type: pillar(기둥) / door(문 회전반경) / counter(붙박이) / window(창, 두께 0)
polygon_on_plan: 도면 이미지(850x1024) 픽셀 좌표.
※ 세로 치수, 기둥/문/창 위치는 도면 비율로 추정한 값 → 실측 후 수정 권장.
