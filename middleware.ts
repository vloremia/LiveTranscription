import { NextResponse, type NextRequest } from "next/server";

const parseCSV = (value: string | undefined, fallback: string[] = []): string[] => {
  const parsed = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, array) => array.indexOf(entry) === index);

  if (parsed.length > 0) {
    return parsed;
  }

  return fallback;
};

const corsOptions = {
  allowedMethods: parseCSV(process.env.ALLOWED_METHODS, ["GET", "HEAD", "OPTIONS"]),
  allowedOrigins: parseCSV(process.env.ALLOWED_ORIGIN, ["*"]),
  allowedHeaders: parseCSV(process.env.ALLOWED_HEADERS, ["Content-Type", "Authorization"]),
  exposedHeaders: parseCSV(process.env.EXPOSED_HEADERS),
  maxAge:
    process.env.PREFLIGHT_MAX_AGE !== undefined
      ? parseInt(process.env.PREFLIGHT_MAX_AGE, 10)
      : undefined,
  credentials: process.env.CREDENTIALS === "true",
};

const applyCorsHeaders = (request: NextRequest, response: NextResponse): NextResponse => {
  const origin = request.headers.get("origin") ?? "";
  const allowAllOrigins = corsOptions.allowedOrigins.includes("*");

  if (allowAllOrigins) {
    response.headers.set("Access-Control-Allow-Origin", "*");
  } else if (origin && corsOptions.allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }

  response.headers.set(
    "Access-Control-Allow-Credentials",
    corsOptions.credentials.toString()
  );
  response.headers.set(
    "Access-Control-Allow-Methods",
    corsOptions.allowedMethods.join(",")
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    corsOptions.allowedHeaders.join(",")
  );

  if (corsOptions.exposedHeaders.length > 0) {
    response.headers.set(
      "Access-Control-Expose-Headers",
      corsOptions.exposedHeaders.join(",")
    );
  }

  if (typeof corsOptions.maxAge === "number" && !Number.isNaN(corsOptions.maxAge)) {
    response.headers.set("Access-Control-Max-Age", String(corsOptions.maxAge));
  }

  return response;
};

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return applyCorsHeaders(request, new NextResponse(null, { status: 204 }));
  }

  return applyCorsHeaders(request, NextResponse.next());
}

export const config = {
  matcher: "/api/authenticate",
};
