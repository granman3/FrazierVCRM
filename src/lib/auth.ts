import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, tenants, accounts, sessions, verificationTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as NextAuthOptions["adapter"],

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "consent",
          access_type: "offline",
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    newUser: "/setup", // Redirect new users to setup wizard
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false;
      }

      // Check if this is the platform admin email
      const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL;

      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, user.email),
      });

      if (!existingUser) {
        // First user with PLATFORM_ADMIN_EMAIL becomes platform admin
        if (platformAdminEmail && user.email === platformAdminEmail) {
          // Check if there are any existing platform admins
          const existingPlatformAdmin = await db.query.users.findFirst({
            where: eq(users.role, "platform_admin"),
          });

          if (!existingPlatformAdmin) {
            // This is the first platform admin - create a personal tenant for them
            const [tenant] = await db
              .insert(tenants)
              .values({
                name: `${user.name || user.email}'s Workspace`,
              })
              .returning();

            // Create the user as platform admin
            await db.insert(users).values({
              email: user.email,
              name: user.name,
              image: user.image,
              role: "platform_admin",
              tenantId: tenant.id,
              emailVerified: new Date(),
            });

            return true;
          }
        }
        // Non-platform-admin users must have an invite
        // This will be handled by the invite acceptance flow
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        // Fetch full user data from database
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, user.email!),
          with: {
            tenant: true,
          },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId;
          token.tenantName = dbUser.tenant?.name;
          token.setupComplete = dbUser.tenant?.setupCompletedAt !== null;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.tenantId = token.tenantId as string | null;
        session.user.tenantName = token.tenantName as string | undefined;
        session.user.setupComplete = token.setupComplete as boolean;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // After sign in, redirect based on setup status
      if (url === baseUrl || url === `${baseUrl}/`) {
        // Check if setup is complete - this will be handled by middleware
        return `${baseUrl}/dashboard`;
      }
      // Relative URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // URLs on same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      return baseUrl;
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      // Log sign in event (will be expanded later with audit logging)
      console.log(`User signed in: ${user.email}, isNewUser: ${isNewUser}`);
    },
  },

  debug: process.env.NODE_ENV === "development",
};

// Type augmentation for next-auth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      tenantId: string | null;
      tenantName?: string;
      setupComplete: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    tenantId?: string | null;
    tenantName?: string;
    setupComplete?: boolean;
  }
}
