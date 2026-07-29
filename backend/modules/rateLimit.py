import os
from collections.abc import Callable
from functools import wraps
from inspect import iscoroutinefunction, signature

from fastapi import HTTPException
from limits import RateLimitItemPerSecond
from limits.storage import MemoryStorage
from limits.strategies import FixedWindowRateLimiter


def rate_limit(*, limit: int, window: int, key: str | Callable):
    storage = MemoryStorage()
    limiter = FixedWindowRateLimiter(storage)
    rate = RateLimitItemPerSecond(limit, window)

    def decorator(func):
        sig = signature(func)
        if isinstance(key, str) and key not in sig.parameters:
            raise ValueError(f"Unknown parameter '{key}' for {func.__name__}")

        def check_rate_limit(args, kwargs):
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()

            if os.getenv("TESTING", "false").lower() == "true":
                return

            if isinstance(key, str):
                identifier = bound.arguments[key]
            else:
                identifier = key(bound.arguments)

            if not limiter.hit(rate, str(identifier)):
                raise HTTPException(status_code=429, detail="Rate limit exceeded")

        if iscoroutinefunction(func):

            @wraps(func)
            async def wrapper(*args, **kwargs):
                check_rate_limit(args, kwargs)
                return await func(*args, **kwargs)
        else:

            @wraps(func)
            def wrapper(*args, **kwargs):
                check_rate_limit(args, kwargs)
                return func(*args, **kwargs)

        return wrapper

    return decorator
