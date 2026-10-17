import json, pathlib
from dotenv import load_dotenv
load_dotenv(pathlib.Path(__file__).parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from geometry import validate
import llm

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
ROOMS = json.loads((pathlib.Path(__file__).parent / "rooms.json").read_text(encoding="utf-8"))

SYSTEM = """너는 인테리어 가구 배치 전문가다.
- 단위 mm, 원점은 방 좌상단, x는 오른쪽, y는 아래쪽.
- (x,y)는 회전 적용 후 가구 외곽 사각형의 좌상단 좌표. rotation은 0,90,180,270 중 하나이며 90/270이면 w와 d가 바뀐다.
- 가구가 차지하는 범위는 x ~ x+폭, y ~ y+깊이 이며 0 이상, 방 width/depth 이하여야 한다.
- pillar(기둥), door(문 회전반경), counter(붙박이 가구) 영역과 절대 겹치지 마라.
- window는 두께 0인 벽면 표시다. 창 앞을 키 큰 가구로 막지 않는 것을 선호.
- 가구끼리 겹치지 말고, furniture의 모든 id를 빠짐없이 정확히 한 번씩 배치하고, 주 동선 폭 600mm 이상 확보.
- 기둥 옆 움푹한 공간은 수납 가구 자리로 활용을 고려.
- current_layout이 있으면 그것을 기준으로 개선한 안을 낸다.
- 컨셉이 서로 다른 A, B, C 3개 안을 plans 배열로 낸다. concept은 짧게, reason은 한국어 2~3문장."""

@app.get("/health")
def health():
    import os
    key = "ANTHROPIC_API_KEY" if llm.PROVIDER == "claude" else "GEMINI_API_KEY"
    return {"ok": True, "llm": llm.PROVIDER, "api_key_set": bool(os.getenv(key)), "rooms": len(ROOMS)}

@app.get("/rooms")
def rooms():
    return ROOMS

@app.post("/generate")
def generate(req: dict):
    room = next((r for r in ROOMS if r["id"] == req.get("room_id")), None)
    if not room:
        raise HTTPException(404, "room not found")
    furniture = req.get("furniture", [])
    if not furniture:
        raise HTTPException(400, "가구를 하나 이상 추가하세요")
    payload = {"room": {k: room[k] for k in ("name", "width", "depth", "obstacles")},
               "furniture": [{k: f[k] for k in ("id", "type", "w", "d")} for f in furniture],
               "requirements": req.get("requirements", []),
               "current_layout": req.get("current_layout")}
    chat = llm.new_chat(SYSTEM)
    text = json.dumps(payload, ensure_ascii=False)
    plans, report = [], {}
    for attempt in range(3):
        plans = chat.ask(text)
        report = {p["id"]: validate(room, furniture, p["items"]) for p in plans}
        if not any(report.values()):
            return {"plans": plans, "ok": True, "attempts": attempt + 1}
        text = "다음 위반을 모두 고쳐서 A, B, C 3개 안을 다시 내라: " + json.dumps(report, ensure_ascii=False)
    return {"plans": plans, "ok": False, "errors": report, "attempts": 3}
