import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/clear-session
 * Clears all auth + company cookies and redirects to /login.
 * Useful when switching databases or after a database reset.
 */
export async function GET() {
  const jar = await cookies();

  // Clear all auth and company cookies
  jar.delete("authjs.session-token");
  jar.delete("__Secure-authjs.session-token");
  jar.delete("authjs.csrf-token");
  jar.delete("__Host-authjs.csrf-token");
  jar.delete("bb_company");
  jar.delete("bb_firm");
  jar.delete("next-auth.session-token");
  jar.delete("next-auth.csrf-token");

  const response = NextResponse.redirect(new URL("/login", "http://localhost:3000"));
  // Also clear via response headers for anything we missed
  response.cookies.delete("authjs.session-token");
  response.cookies.delete("__Secure-authjs.session-token");
  response.cookies.delete("authjs.csrf-token");
  response.cookies.delete("__Host-authjs.csrf-token");
  response.cookies.delete("bb_company");
  response.cookies.delete("bb_firm");
  response.cookies.delete("next-auth.session-token");
  response.cookies.delete("next-auth.csrf-token");

  return response;
}
