import { NextResponse } from "next/server";

/**
 * Standardized API response format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  message?: string;
}

/**
 * Create a successful response with data
 * @param data - The response data
 * @param message - Optional success message
 * @returns NextResponse with 200 status
 */
export function successResponse<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  const body: ApiResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    body.message = message;
  }

  return NextResponse.json(body, { status: 200 });
}

/**
 * Create a successful response for resource creation
 * @param data - The created resource data
 * @param message - Optional success message
 * @returns NextResponse with 201 status
 */
export function createdResponse<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  const body: ApiResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    body.message = message;
  }

  return NextResponse.json(body, { status: 201 });
}

/**
 * Create an error response with custom status
 * @param message - Error message
 * @param status - HTTP status code
 * @param details - Optional additional error details
 * @returns NextResponse with specified status
 */
export function errorResponse(
  message: string,
  status: number,
  details?: any
): NextResponse<ApiResponse> {
  const body: ApiResponse = {
    success: false,
    error: message,
  };

  if (details !== undefined) {
    body.details = details;
  }

  return NextResponse.json(body, { status });
}

/**
 * Create a validation error response (400 Bad Request)
 * @param errors - Validation errors (can be string, array, or object)
 * @returns NextResponse with 400 status
 */
export function validationError(
  errors: string | string[] | Record<string, string | string[]>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: "Validation failed",
      details: errors,
    },
    { status: 400 }
  );
}

/**
 * Create an unauthorized error response (401)
 * @param message - Optional custom message
 * @returns NextResponse with 401 status
 */
export function unauthorizedError(message?: string): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message || "Unauthorized",
    },
    { status: 401 }
  );
}

/**
 * Create a forbidden error response (403)
 * @param message - Optional custom message
 * @returns NextResponse with 403 status
 */
export function forbiddenError(message?: string): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message || "Forbidden",
    },
    { status: 403 }
  );
}

/**
 * Create a not found error response (404)
 * @param message - Optional custom message
 * @returns NextResponse with 404 status
 */
export function notFoundError(message?: string): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message || "Not found",
    },
    { status: 404 }
  );
}

/**
 * Create a server error response (500)
 * Logs the error and returns a generic message to avoid leaking internals
 * @param error - The error object (will be logged but not exposed)
 * @param context - Optional context string for logging
 * @returns NextResponse with 500 status
 */
export function serverError(
  error: unknown,
  context?: string
): NextResponse<ApiResponse> {
  // Log the full error for debugging
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(
    `[Server Error]${context ? ` [${context}]` : ""}:`,
    errorMessage,
    errorStack ? `\nStack: ${errorStack}` : ""
  );

  return NextResponse.json(
    {
      success: false,
      error: "Internal server error",
    },
    { status: 500 }
  );
}

/**
 * Create a conflict error response (409)
 * @param message - Optional custom message
 * @returns NextResponse with 409 status
 */
export function conflictError(message?: string): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message || "Conflict",
    },
    { status: 409 }
  );
}

/**
 * Create a rate limit error response (429)
 * @param message - Optional custom message
 * @returns NextResponse with 429 status
 */
export function rateLimitError(message?: string): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message || "Too many requests",
    },
    { status: 429 }
  );
}
