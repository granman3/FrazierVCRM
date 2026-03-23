import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Public routes - no auth needed
    if (
      pathname === "/" ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api/auth") ||
      pathname === "/security" ||
      pathname === "/privacy" ||
      pathname === "/terms" ||
      pathname.startsWith("/invite")
    ) {
      return NextResponse.next();
    }

    // User is authenticated
    if (token) {
      // Check if user has a tenant
      if (!token.tenantId && !pathname.startsWith("/invite")) {
        // User has no tenant - must accept an invite first
        // Unless they're coming from an invite link
        return NextResponse.redirect(new URL("/auth/no-tenant", req.url));
      }

      // Check if setup is complete
      if (!token.setupComplete && pathname.startsWith("/dashboard")) {
        // Redirect to setup wizard
        return NextResponse.redirect(new URL("/setup", req.url));
      }

      // If setup is complete and trying to access /setup, redirect to dashboard
      if (token.setupComplete && pathname.startsWith("/setup")) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }

      // Admin-only routes
      if (pathname.startsWith("/admin")) {
        if (token.role !== "platform_admin" && token.role !== "admin") {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
      }

      // Platform admin only routes
      if (pathname.startsWith("/platform-admin")) {
        if (token.role !== "platform_admin") {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Public routes
        if (
          pathname === "/" ||
          pathname.startsWith("/auth") ||
          pathname.startsWith("/api/auth") ||
          pathname === "/security" ||
          pathname === "/privacy" ||
          pathname === "/terms" ||
          pathname.startsWith("/invite")
        ) {
          return true;
        }

        // All other routes require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
