const trailingSlash = /\/$/;

function requiredUrl(name: "EXPO_PUBLIC_API_URL") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Copy .env.example to .env and set the API origin.`);
  }

  try {
    return new URL(value).origin.replace(trailingSlash, "");
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

function path(value: string | undefined, fallback: string) {
  const candidate = value?.trim() || fallback;
  return candidate.startsWith("/") ? candidate.replace(trailingSlash, "") : `/${candidate}`;
}

export const env = {
  apiUrl: requiredUrl("EXPO_PUBLIC_API_URL"),
  applicationMode: process.env.EXPO_PUBLIC_APPLICATION_MODE?.trim() || "development",
  authBasePath: path(process.env.EXPO_PUBLIC_AUTH_BASE_PATH, "/api/auth"),
  apiPrefix: path(process.env.EXPO_PUBLIC_API_PREFIX, "/api/v1"),
  graphqlPath: path(process.env.EXPO_PUBLIC_GRAPHQL_PATH, "/graphql"),
  olaMapsApiKey: process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY?.trim() || undefined,
};
