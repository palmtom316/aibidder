import base64

import httpx

from app.core.config import settings


def request_ocr_page_texts(page_images: list[bytes]) -> list[str]:
    provider = (settings.ocr_provider or "openai_compatible").strip().lower()
    if provider == "mineru":
        return _request_with_mineru(page_images)
    return _request_with_openai_compatible(page_images)


def _request_with_openai_compatible(page_images: list[bytes]) -> list[str]:
    api_base_url = settings.ocr_api_base_url or settings.runtime_api_base_url
    api_key = settings.ocr_api_key or settings.runtime_api_key
    if not api_base_url or not api_key:
        return []

    outputs: list[str] = []
    url = f"{api_base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"}
    for image_bytes in page_images:
        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        payload = {
            "model": settings.ocr_role_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract all readable text from this document page as plain text."},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                    ],
                }
            ],
        }
        try:
            with httpx.Client(timeout=settings.ocr_request_timeout_seconds) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
        except httpx.HTTPError:
            return []
        outputs.append(_extract_openai_text(response.json()))
    return outputs


def _request_with_mineru(page_images: list[bytes]) -> list[str]:
    api_base_url = settings.mineru_api_base_url or settings.ocr_api_base_url
    api_key = settings.mineru_api_key or settings.ocr_api_key or settings.runtime_api_key
    if not api_base_url or not api_key:
        return []

    outputs: list[str] = []
    url = f"{api_base_url.rstrip('/')}/ocr"
    headers = {"Authorization": f"Bearer {api_key}"}
    for image_bytes in page_images:
        files = {"file": ("page.png", image_bytes, "image/png")}
        try:
            with httpx.Client(timeout=settings.ocr_request_timeout_seconds) as client:
                response = client.post(url, headers=headers, files=files)
                response.raise_for_status()
        except httpx.HTTPError:
            return []
        data = response.json()
        outputs.append(str(data.get("text") or "").strip())
    return outputs


def _extract_openai_text(payload: dict) -> str:
    choices = payload.get("choices", [])
    if not choices:
        return ""
    message = choices[0].get("message", {})
    content = message.get("content", "")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                chunks.append(item["text"].strip())
        return "\n".join(chunk for chunk in chunks if chunk)
    return ""
