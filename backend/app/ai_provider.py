"""Provider compatibility and safe diagnostics: never return upstream error bodies."""
from urllib.parse import urlparse

from fastapi import HTTPException

from .config import settings


def connection():
    base = settings.ai_base_url.strip().rstrip('/')
    model = settings.ai_model.strip()
    if not base or not model:
        raise HTTPException(503, "Agent is not connected. Configure AI_BASE_URL, AI_MODEL and AI_API_KEY on the server.")
    parsed = urlparse(base)
    if (parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username
            or parsed.password or parsed.query or parsed.fragment):
        raise HTTPException(503, "Invalid AI endpoint configuration.")
    official = parsed.hostname.lower() == 'api.openai.com'
    key = settings.ai_api_key.get_secret_value().strip()
    if official and parsed.scheme != 'https':
        raise HTTPException(503, "OpenAI requires an HTTPS API endpoint.")
    if official and not key:
        raise HTTPException(503, "AI_API_KEY is missing. Set it for the API service in Coolify and redeploy.")
    # Accept an accidentally pasted complete endpoint without doubling its path.
    endpoint = base if parsed.path.endswith('/chat/completions') else base + '/chat/completions'
    return endpoint, model, {"Authorization": "Bearer " + key} if key else {}, official


def error_fields(response):
    try:
        error = response.json().get('error', {})
        if isinstance(error, dict):
            # Values are used only for classification, never echoed into errors/logs.
            return tuple(value if isinstance(value, str) else None
                         for value in (error.get('code'), error.get('type'), error.get('param')))
    except (ValueError, AttributeError):
        pass
    return None, None, None


def provider_error(response):
    code, category, param = error_fields(response)
    status = response.status_code
    if status == 401:
        message = "AI provider rejected the API key (HTTP 401). Check AI_API_KEY in Coolify and redeploy."
    elif status == 403:
        message = "AI provider denied access (HTTP 403). Check project permissions and model access."
    elif code == 'model_not_found':
        message = "AI model was not found or is unavailable to this API key. Check AI_MODEL and project access."
    elif status == 404:
        message = "AI endpoint or model was not found (HTTP 404). Check AI_BASE_URL and AI_MODEL."
    elif status == 429 and (code == 'insufficient_quota' or category == 'insufficient_quota'):
        message = "AI API quota is exhausted (HTTP 429). Check the API project's billing, credits and usage limits."
    elif status == 429:
        message = "AI provider rate limit reached (HTTP 429). Wait briefly and retry."
    elif code == 'context_length_exceeded':
        message = "AI model context limit exceeded. Start a new chat or use a model with a larger context window."
    elif status in {400, 422}:
        message = "AI provider rejected the request parameters (HTTP 400/422). The model must support Chat Completions and, for vault access, tool calling."
    elif status >= 500:
        message = "AI provider is temporarily unavailable (HTTP 5xx). Please retry later."
    else:
        message = "AI provider returned an unexpected HTTP status. Check the endpoint and provider service."
    raise HTTPException(502, message)


async def completion(client, endpoint, headers, payload):
    response = await client.post(endpoint, headers=headers, json=payload)
    # Some compatible gateways support only one token-limit name. Retry only a
    # rejected parameter, never successful generations or other failure classes.
    code, _, param = error_fields(response) if response.status_code == 400 else (None, None, None)
    if code == 'unsupported_parameter' and param in {'max_tokens', 'max_completion_tokens'} and param in payload:
        alternate = 'max_completion_tokens' if param == 'max_tokens' else 'max_tokens'
        payload = {**payload, alternate: payload[param]}
        del payload[param]
        response = await client.post(endpoint, headers=headers, json=payload)
    if not response.is_success:
        provider_error(response)
    try:
        result = response.json()['choices'][0]
        answer = result['message']
        if not isinstance(answer, dict) or answer.get('role') != 'assistant':
            raise ValueError('Invalid message')
        calls = answer.get('tool_calls') or []
        if not isinstance(calls, list) or any(
            not isinstance(call, dict) or not isinstance(call.get('id'), str)
            or not isinstance(call.get('function'), dict)
            or not isinstance(call['function'].get('name'), str)
            or not isinstance(call['function'].get('arguments'), str) for call in calls
        ):
            raise ValueError('Invalid tool calls')
        answer['tool_calls'] = calls
        content = answer.get('content')
        if content is not None and not isinstance(content, str):
            raise ValueError('Invalid text')
        if not calls and (not content or not content.strip()):
            if result.get('finish_reason') == 'length':
                raise HTTPException(502, "AI model reached its output limit before producing an answer. Try a shorter question or a non-reasoning model.")
            raise HTTPException(502, "AI provider returned no answer. Check the model's Chat Completions support.")
        return answer
    except (ValueError, KeyError, TypeError, IndexError):
        raise HTTPException(502, "AI provider returned an invalid Chat Completions response. Check the endpoint and model compatibility.")
