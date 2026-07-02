"""AI Analysis Service — single interface for all AI-driven evaluation.
Swap the underlying provider by changing only this file. Callers use `AIAnalysisService`.
"""
import os
import json
import uuid
import logging
from typing import Any

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger("ai_service")

MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


class AIAnalysisService:
    """Abstract interface. Concrete impl below. Swap by changing `get_ai_service()`."""

    async def analyze_repo(self, challenge: dict, repo_files: list[dict]) -> dict:
        raise NotImplementedError

    async def grade_answers(self, questions: list[dict], answers: list[str]) -> list[dict]:
        raise NotImplementedError


class EmergentAnthropicAnalysisService(AIAnalysisService):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def _chat(self, system: str) -> LlmChat:
        return (
            LlmChat(api_key=self.api_key, session_id=str(uuid.uuid4()), system_message=system)
            .with_model(MODEL_PROVIDER, MODEL_NAME)
        )

    async def analyze_repo(self, challenge: dict, repo_files: list[dict]) -> dict:
        files_blob = "\n\n".join(
            f"=== FILE: {f['path']} ===\n{f['content']}" for f in repo_files
        )[:180_000]
        system = (
            "You are a senior software engineering interviewer reviewing a candidate's GitHub submission. "
            "Return STRICT JSON only, no prose, no code fences."
        )
        prompt = f"""Challenge: {challenge['title']}
Description: {challenge['description']}
Requirements: {json.dumps(challenge['requirements'])}
Acceptance criteria: {json.dumps(challenge['acceptance'])}

Repository files below.

Return JSON with this exact shape:
{{
  "requirements": [{{"requirement": "<text>", "met": true|false, "evidence": "<file:line or file path>"}}],
  "code_quality": ["<short note>", "..."],
  "questions": [
    {{"id": "q1", "question": "<question referencing a specific file/function from the repo>", "code_reference": {{"path": "<file>", "snippet": "<10-30 line snippet>"}}}}
  ]
}}
Rules: 4-6 questions. Each question MUST reference a real file/function in the submitted repo by name. Code quality notes: 3-6 short bullets. Do not invent files not present.

--- REPO FILES ---
{files_blob}
"""
        chat = self._chat(system)
        resp = await chat.send_message(UserMessage(text=prompt))
        return _extract_json(resp)

    async def grade_answers(self, questions: list[dict], answers: list[str]) -> list[dict]:
        pairs = [
            {"id": q["id"], "question": q["question"],
             "code_reference": q.get("code_reference", {}),
             "answer": answers[i] if i < len(answers) else ""}
            for i, q in enumerate(questions)
        ]
        system = (
            "You are grading interview answers. For each item, decide if the candidate's answer shows understanding "
            "of the specific code referenced. Return STRICT JSON only, no prose."
        )
        prompt = f"""Grade each answer. Verdict must be exactly one of:
"strong understanding", "partial understanding", "answer doesn't match the code".

Return JSON:
{{"grades": [{{"id": "q1", "verdict": "...", "reasoning": "<one sentence>"}}]}}

Items:
{json.dumps(pairs, indent=2)}
"""
        chat = self._chat(system)
        resp = await chat.send_message(UserMessage(text=prompt))
        data = _extract_json(resp)
        return data.get("grades", [])


_service_singleton: AIAnalysisService | None = None


def get_ai_service() -> AIAnalysisService:
    global _service_singleton
    if _service_singleton is None:
        key = os.environ.get("EMERGENT_LLM_KEY", "")
        if not key:
            raise RuntimeError("EMERGENT_LLM_KEY is not configured")
        _service_singleton = EmergentAnthropicAnalysisService(api_key=key)
    return _service_singleton
