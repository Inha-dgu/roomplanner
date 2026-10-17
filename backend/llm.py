"""LLM 공급자 교체 모듈. .env의 LLM=gemini | claude 로 선택."""
import json, os
from typing import List, Literal
from fastapi import HTTPException
from pydantic import BaseModel

PROVIDER = os.getenv("LLM", "gemini").lower()

class Item(BaseModel):
    id: str
    x: int
    y: int
    rotation: int  # 0/90/180/270

class Plan(BaseModel):
    id: Literal["A", "B", "C"]
    concept: str
    reason: str
    items: List[Item]

class Plans(BaseModel):
    plans: List[Plan]

def _normalize(plans):
    for p in plans:
        for it in p["items"]:
            it["rotation"] = int(round(it.get("rotation", 0) / 90.0)) % 4 * 90
    return plans


class GeminiChat:
    def __init__(self, system):
        from google import genai
        from google.genai import types
        key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not key:
            raise HTTPException(500, "GEMINI_API_KEY가 설정되지 않았습니다 (.env 확인)")
        self.types = types
        self.client = genai.Client(api_key=key)
        self.model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
        self.config = types.GenerateContentConfig(
            system_instruction=system, temperature=0.7,
            response_mime_type="application/json", response_schema=Plans)
        self.history = []

    def ask(self, text):
        t = self.types
        self.history.append(t.Content(role="user", parts=[t.Part(text=text)]))
        try:
            res = self.client.models.generate_content(
                model=self.model, contents=self.history, config=self.config)
        except Exception as e:
            msg = str(e)
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                raise HTTPException(429, "Gemini 무료 한도 초과 — 1분쯤 뒤 다시 시도하세요")
            raise HTTPException(502, f"Gemini 오류: {msg[:300]}")
        self.history.append(t.Content(role="model", parts=[t.Part(text=res.text)]))
        data = res.parsed.model_dump() if res.parsed else json.loads(res.text)
        return _normalize(data["plans"])


class ClaudeChat:
    TOOL = {"name": "submit_plans", "description": "가구 배치안 A, B, C 제출",
            "input_schema": Plans.model_json_schema()}

    def __init__(self, system):
        import anthropic
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise HTTPException(500, "ANTHROPIC_API_KEY가 설정되지 않았습니다 (.env 확인)")
        self.client = anthropic.Anthropic()
        self.model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5")
        self.system, self.messages, self.last = system, [], None

    def ask(self, text):
        if self.last is None:
            self.messages.append({"role": "user", "content": text})
        else:
            self.messages.append({"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": self.last, "content": text}]})
        res = self.client.messages.create(
            model=self.model, max_tokens=4000, system=self.system,
            tools=[self.TOOL], tool_choice={"type": "tool", "name": "submit_plans"},
            messages=self.messages)
        tu = next(b for b in res.content if b.type == "tool_use")
        self.messages.append({"role": "assistant", "content": res.content})
        self.last = tu.id
        return _normalize(tu.input["plans"])


def new_chat(system):
    return ClaudeChat(system) if PROVIDER == "claude" else GeminiChat(system)
