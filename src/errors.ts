export class ToolError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    options: { status?: number; details?: unknown; retryable?: boolean } = {}
  ) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.status = options.status;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
  }
}

export function errorToStructured(error: unknown): {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
  retryable: boolean;
} {
  if (error instanceof ToolError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
      retryable: error.retryable
    };
  }

  if (error instanceof Error) {
    return {
      code: "internal_error",
      message: error.message,
      retryable: false
    };
  }

  return {
    code: "internal_error",
    message: "Unknown error",
    retryable: false
  };
}

export function requireEnabled(enabled: boolean, code: string, message: string): void {
  if (!enabled) {
    throw new ToolError(code, message);
  }
}

