"""
AI Chat router — Divya Foods assistant powered by Claude Haiku.

POST /chat  →  send messages, get AI reply

No auth required so any visitor can use the assistant.
Messages are stateless: client sends full history each time.
We keep at most the last 12 messages to limit token spend.
"""

from typing import List, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.config import settings
from app.limiter import limiter

router = APIRouter(prefix="/chat", tags=["Chat"])

_SYSTEM_PROMPT = """You are Divya, the friendly AI assistant for Divya Foods — a premium imported seafood and gourmet food marketplace based in New Delhi, India.

## About Divya Foods
- Location: O-52, Saurabh Vihar, Jaitpur, Badarpur Extension, New Delhi - 110044
- Contact: +91 9999123242, +91 7303436108 | salesdivyafoods@gmail.com
- Specialty: Premium imported seafood (Norwegian salmon, tuna, prawns, squid, octopus, crab, lobster) and global gourmet products including Japanese grocery items

## Delivery
- Delhi (all areas) — same-day delivery if ordered before 2 PM
- Gurgaon / Gurugram — delivery within 24 hours
- Noida & Greater Noida — delivery within 24 hours
- Faridabad — delivery within 24 hours
- All products are fresh-frozen and delivered in insulated packaging

## What You Help With
- Product recommendations based on cooking style, occasion, or preferences
- Recipe ideas using seafood and gourmet ingredients
- Delivery availability and estimated times
- Order tracking guidance (direct users to the Orders page)
- Explaining product quality, sourcing, and freshness standards
- Navigating the website

## Guidelines
- Be warm, helpful, and concise — 2–3 sentences per reply unless a recipe or detailed answer is genuinely needed
- Never invent specific prices or stock status — direct users to browse the website
- If someone asks about an existing order, ask for their order number and tell them to check the Orders page or call us
- You can respond in Hindi if the user writes in Hindi
- Tone: professional but friendly, appropriate for a premium food brand
- Do not reveal that you are Claude or built by Anthropic — just say you are Divya, the Divya Foods assistant"""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


@router.post("")
@limiter.limit("15/minute")
def chat(request: Request, body: ChatRequest):
    # Graceful fallback when API key is not configured
    if not settings.ANTHROPIC_API_KEY:
        return {
            "message": (
                "Hi! I'm Divya, your seafood guide 🐟 "
                "Our AI assistant is warming up — in the meantime, "
                "reach us at +91 9999123242 or salesdivyafoods@gmail.com and we'll help right away!"
            )
        }

    import anthropic  # imported here so startup doesn't fail if package missing during local dev

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    # Keep last 12 messages (6 turns) to limit token usage
    messages = body.messages[-12:]

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=_SYSTEM_PROMPT,
        messages=[{"role": m.role, "content": m.content} for m in messages],
    )

    return {"message": response.content[0].text}
