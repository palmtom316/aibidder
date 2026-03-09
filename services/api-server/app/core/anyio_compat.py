import asyncio

import anyio.to_thread

_PATCHED = False


def install_test_thread_compat() -> None:
    global _PATCHED
    if _PATCHED:
        return

    original_run_sync = anyio.to_thread.run_sync

    async def _run_sync_compat(func, *args, **kwargs):
        _ = kwargs
        _ = asyncio.get_running_loop()
        return func(*args)

    anyio.to_thread.run_sync = _run_sync_compat
    anyio.to_thread._original_run_sync = original_run_sync  # type: ignore[attr-defined]
    _PATCHED = True
