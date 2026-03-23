import { NextRequest, NextResponse } from "next/server";

/**
 * GET: Handle OAuth callback from Google
 * This receives the authorization code and redirects to the frontend
 * The frontend will then POST the code to complete the token exchange
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    // Redirect to setup with error
    return NextResponse.redirect(
      new URL(`/setup?error=google_auth_failed&message=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/setup?error=missing_code", request.url)
    );
  }

  // Redirect to frontend with code
  // The frontend will complete the OAuth flow
  const redirectUrl = new URL("/setup", request.url);
  redirectUrl.searchParams.set("google_code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  return NextResponse.redirect(redirectUrl);
}
