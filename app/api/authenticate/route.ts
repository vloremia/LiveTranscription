import { DeepgramError, createClient } from "@deepgram/sdk";
import { NextResponse, type NextRequest } from "next/server";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  // Check if API key is configured
  const apiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_deepgram_api_key_here') {
    console.error("Deepgram API key is not configured properly");
    return NextResponse.json(
      { 
        error: "Deepgram API key is not configured. Please set DEEPGRAM_API_KEY in your .env file.",
        details: "Make sure you have a valid Deepgram API key from https://console.deepgram.com/"
      },
      { status: 500 }
    );
  }


  // gotta use the request object to invalidate the cache every request :vomit:
  const url = request.url;
  
  try {
    const deepgram = createClient(apiKey);

    let { result: tokenResult, error: tokenError } =
      await deepgram.auth.grantToken();

    if (tokenError) {
      console.error("Token generation error:", tokenError);
      return NextResponse.json(
        { 
          error: "Failed to generate temporary token",
          details: tokenError.message || "Unknown error during token generation"
        },
        { status: 500 }
      );
    }

    if (!tokenResult) {
      console.error("No token result returned from Deepgram");
      return NextResponse.json(
        { 
          error: "Failed to generate temporary token. Make sure your API key is of scope Member or higher.",
          details: "The API key may not have sufficient permissions to generate temporary tokens."
        },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ ...tokenResult, url });
    response.headers.set("Surrogate-Control", "no-store");
    response.headers.set(
      "Cache-Control",
      "s-maxage=0, no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    console.error("Unexpected error in authentication:", error);
    return NextResponse.json(
      { 
        error: "Authentication service error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
