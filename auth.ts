import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { AdapterUser } from "@auth/core/adapters";
import { prisma } from "@/lib/prisma";

const adapter = PrismaAdapter(prisma);

adapter.createUser = async (data) => {
  if (!data.email) {
    throw new Error("Email is required to create an account");
  }
  const user = await prisma.user.upsert({
    where: { email: data.email },
    create: { email: data.email, name: data.name, image: data.image } as never,
    update: { name: data.name, image: data.image } as never,
  });
  return user as unknown as AdapterUser;
};

adapter.linkAccount = async (data) => {
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: data.provider as string,
        providerAccountId: data.providerAccountId as string,
      },
    },
    create: data as never,
    update: data as never,
  });
};

const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: adapter as never,
  session: { strategy: "jwt" },
  pages: {
    error: "/auth-error",
  },
  providers: hasGoogle
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          authorization: {
            params: {
              scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
              access_type: "offline",
            },
          },
        }),
      ]
    : [],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});