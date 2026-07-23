export type UserFacingError = {
  status?: number;
  title: string;
  message: string;
};

type ApiErrorBody = {
  detail?: unknown;
  message?: unknown;
  error?: unknown;
};

function extractValidationMessage(item: unknown): string | null {
  if (
    typeof item !== "object" ||
    item === null ||
    !("msg" in item) ||
    typeof item.msg !== "string"
  ) {
    return null;
  }

  let field = "";

  if ("loc" in item && Array.isArray(item.loc)) {
    field = item.loc
      .filter((part: unknown) => part !== "body")
      .map((part: unknown) => String(part))
      .join(".");
  }

  return field ? `${field}: ${item.msg}` : item.msg;
}

function extractApiMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const messages = value
      .map((item: unknown) => extractValidationMessage(item))
      .filter((message): message is string => typeof message === "string");

    return messages.length > 0 ? messages.join(" ") : null;
  }

  if (typeof value === "object" && value !== null) {
    if ("message" in value) {
      const message = extractApiMessage(value.message);

      if (message) {
        return message;
      }
    }

    if ("detail" in value) {
      const detail = extractApiMessage(value.detail);

      if (detail) {
        return detail;
      }
    }

    if ("error" in value) {
      return extractApiMessage(value.error);
    }
  }

  return null;
}

function getStatusTitle(status: number): string {
  switch (status) {
    case 400:
      return "Invalid request";

    case 401:
      return "Sign-in required";

    case 403:
      return "Permission denied";

    case 404:
      return "Not found";

    case 405:
      return "Operation not supported";

    case 408:
      return "Request timed out";

    case 409:
      return "Request conflict";

    case 410:
      return "Upload link expired";

    case 413:
      return "File is too large";

    case 422:
      return "Check the information entered";

    case 429:
      return "Too many requests";

    default:
      return status >= 500 ? "Server error" : "Request failed";
  }
}

function getStatusMessage(status: number, action: string): string {
  switch (status) {
    case 400:
      return (
        `The server could not ${action} because the request ` +
        "was incomplete or invalid."
      );

    case 401:
      return (
        `Your session could not be verified while trying to ${action}. ` +
        "Sign in again and retry."
      );

    case 403:
      return (
        `Your account does not have permission to ${action}. ` +
        "Contact an administrator if you believe this is incorrect."
      );

    case 404:
      return (
        `The server could not find the resource needed to ${action}. ` +
        "It may no longer exist, or the application may be using an outdated URL."
      );

    case 405:
      return (
        `The server does not support the requested operation to ${action}. ` +
        "The frontend and backend may be using different API versions."
      );

    case 408:
      return (
        `The request to ${action} took too long. ` +
        "Check your connection and try again."
      );

    case 409:
      return (
        `The request to ${action} conflicts with the current server state. ` +
        "Refresh the page and try again."
      );

    case 410:
      return (
        `This upload link has expired and can no longer be used to ${action}. ` +
        "Request a new upload link."
      );

    case 413:
      return (
        `The selected file is too large to ${action}. ` +
        "Choose a smaller file or contact support about the upload limit."
      );

    case 422:
      return (
        `Some information required to ${action} is missing or invalid. ` +
        "Review the information and try again."
      );

    case 429:
      return (
        `Too many requests were made while trying to ${action}. ` +
        "Wait briefly and try again."
      );

    default:
      return status >= 500
        ? `The server encountered an unexpected problem while trying to ${action}. ` +
            "Try again. If the problem continues, contact support."
        : `The request to ${action} could not be completed.`;
  }
}

export async function readApiError(
  response: Response,
  action: string,
): Promise<UserFacingError> {
  let serverMessage: string | null = null;

  try {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await response.json()) as ApiErrorBody;

      serverMessage =
        extractApiMessage(body.detail) ??
        extractApiMessage(body.message) ??
        extractApiMessage(body.error);
    } else {
      const text = await response.text();

      serverMessage = text.trim() || null;
    }
  } catch {
    serverMessage = null;
  }

  return {
    status: response.status,
    title: getStatusTitle(response.status),
    message: serverMessage ?? getStatusMessage(response.status, action),
  };
}

export function getUnexpectedError(
  error: unknown,
  action: string,
): UserFacingError {
  if (error instanceof TypeError) {
    return {
      title: "Unable to reach the server",
      message:
        `The application could not connect to the server to ${action}. ` +
        "Check your network connection and try again.",
    };
  }

  if (error instanceof Error && error.message.trim()) {
    return {
      title: "Request failed",
      message: error.message.trim(),
    };
  }

  return {
    title: "Unexpected error",
    message:
      `An unexpected problem occurred while trying to ${action}. ` +
      "Try again. If the problem continues, contact support.",
  };
}
