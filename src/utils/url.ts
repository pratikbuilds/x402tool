export function validateUrlScheme(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  const protocol = parsed.protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(
      `URL scheme must be http or https, got ${protocol.slice(0, -1)}`
    );
  }
}

export function buildUrlWithQueryParams(
  baseUrl: string,
  queryParams?: Record<string, string>
): string {
  if (!queryParams || Object.keys(queryParams).length === 0) {
    return baseUrl;
  }

  const urlSearchParams = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    urlSearchParams.append(key, String(value));
  });

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${urlSearchParams.toString()}`;
}

export function parseQueryOption(
  val: string,
  prev: Record<string, string> = {}
): Record<string, string> {
  const [key, ...valueParts] = val.split("=");
  if (!key) {
    throw new Error(
      `Invalid query parameter format: ${val}. Use --query key=value`
    );
  }
  const value = valueParts.join("="); // Handle values that contain '='
  prev[key] = value;
  return prev;
}

export function parseHeaderOption(
  val: string,
  prev: Record<string, string> = {}
): Record<string, string> {
  const colonIndex = val.indexOf(":");
  const equalsIndex = val.indexOf("=");
  const separatorIndex =
    colonIndex > 0 ? colonIndex : equalsIndex > 0 ? equalsIndex : -1;
  if (separatorIndex <= 0) {
    throw new Error(
      `Invalid header format: ${val}. Use --header "Key: Value" or --header key=value`
    );
  }

  const key = val.slice(0, separatorIndex).trim();
  const value = val.slice(separatorIndex + 1).trim();
  if (!key) {
    throw new Error(
      `Invalid header format: ${val}. Use --header "Key: Value" or --header key=value`
    );
  }

  prev[key] = value;
  return prev;
}
