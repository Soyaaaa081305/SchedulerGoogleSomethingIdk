import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "googleapis", "web-push", "better-sqlite3", "prisma"],
};

export default nextConfig;