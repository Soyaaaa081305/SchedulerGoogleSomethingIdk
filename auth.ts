import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const adapter = PrismaAdapter(prisma);

adapter.createUser = async (data) => {
  return prisma.user.upsert({
    where: { email: data.email ?? "" },
    create: data as never,
    update: data as never,
  });
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: adapter as never,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  events: {
    async signOut(event) {
      const token = (event as { token?: { sub?: string } }).token;
      if (token?.sub) {
        await prisma.account
          .deleteMany({ where: { userId: token.sub } })
          .catch(() => {});
      }
    },
  },
});