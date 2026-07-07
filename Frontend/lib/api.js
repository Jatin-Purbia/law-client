const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "ApiError";
    this.code = options.code || "API_ERROR";
  }
}

function toApiUrl(path) {
  return `${DEFAULT_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readPayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text ? { message: text } : null;
  } catch {
    return null;
  }
}

export async function fetchApi(path, options) {
  let response;

  try {
    response = await fetch(toApiUrl(path), options);
  } catch (error) {
    throw new ApiError(
      "Could not connect to the backend server. Please make sure it is running.",
      {
        cause: error,
        code: "API_UNAVAILABLE",
      },
    );
  }

  const payload = await readPayload(response);

  if (!response.ok) {
    throw new ApiError(
      payload?.message ||
        payload?.error ||
        `Request failed with status ${response.status}.`,
      {
        code: `HTTP_${response.status}`,
      },
    );
  }

  return payload;
}

export function isExpectedApiError(error) {
  return error instanceof ApiError;
}
