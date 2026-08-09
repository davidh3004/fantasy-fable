import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Russo_One } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { APP_NAME, SITE_URL } from "@/lib/config";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const russoOne = Russo_One({
  variable: "--font-russo",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "El juego de fútbol fantasy de la Liga Dominicana.",
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0f23",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`dark ${chakraPetch.variable} ${russoOne.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col">
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
