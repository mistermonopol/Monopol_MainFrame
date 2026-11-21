"""RFC 6238 TOTP with the default authenticator settings: SHA-1, six digits, 30 seconds."""
import base64
import binascii
import hashlib
import hmac
import re


def decode_secret(value: str) -> bytes:
    value = value.strip().upper()
    if not re.fullmatch(r'[A-Z2-7]{32,128}', value):
        raise ValueError('ADMIN_TOTP_SECRET must be an unpadded Base32 secret of at least 160 bits')
    try:
        return base64.b32decode(value + '=' * (-len(value) % 8))
    except binascii.Error:
        raise ValueError('ADMIN_TOTP_SECRET must be valid unpadded Base32') from None


def code_at(secret: bytes, step: int) -> str:
    digest = hmac.digest(secret, step.to_bytes(8, 'big'), hashlib.sha1)
    offset = digest[-1] & 15
    value = int.from_bytes(digest[offset:offset + 4], 'big') & 0x7fffffff
    return f'{value % 1_000_000:06d}'


def verified_step(secret: bytes, code: str, timestamp: float) -> int | None:
    if not re.fullmatch(r'[0-9]{6}', code):
        return None
    step = int(timestamp) // 30
    matches = [candidate for candidate in (step - 1, step, step + 1)
               if candidate >= 0 and hmac.compare_digest(code, code_at(secret, candidate))]
    return max(matches, default=None)
