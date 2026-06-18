import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Stray lockfile in the user home dir confuses workspace-root inference.
  turbopack: { root: __dirname },
};

export default withNextIntl(nextConfig);
