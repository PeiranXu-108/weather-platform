export function createAbortError(message = 'Request aborted'): DOMException {
  return new DOMException(message, 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    error instanceof Error && (error.name === 'AbortError' || error.name === 'APIUserAbortError')
  );
}

export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'TimeoutError'
  ) || (
    error instanceof Error && (error.name === 'TimeoutError' || error.name === 'APIConnectionTimeoutError')
  );
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason ?? createAbortError();
}

export function withTimeoutSignal(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
  timeoutMessage = `Request timed out after ${timeoutMs}ms`
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const abortFromParent = () => {
    controller.abort(parentSignal?.reason ?? createAbortError());
  };

  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });
    timeoutId = setTimeout(() => {
      controller.abort(new DOMException(timeoutMessage, 'TimeoutError'));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId);
      parentSignal?.removeEventListener('abort', abortFromParent);
    },
  };
}
