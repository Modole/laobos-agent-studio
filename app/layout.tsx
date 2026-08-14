import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const socialImage = new URL("/laobos-logo.png", `${protocol}://${host}`).toString();

  return {
    title: "劳博士",
    description: "本地优先的 Agent 对话与配置工作台。",
    openGraph: {
      title: "劳博士 — Agent 客户端",
      description: "本地优先的 Agent 对话与配置工作台。",
      images: [{ url: socialImage, width: 1024, height: 1024, alt: "劳博士 Agent 客户端 Logo" }],
    },
    twitter: {
      card: "summary",
      title: "劳博士 — Agent 客户端",
      description: "本地优先的 Agent 对话与配置工作台。",
      images: [socialImage],
    },
    icons: {
      icon: "/laobos-logo.png",
      shortcut: "/laobos-logo.png",
      apple: "/laobos-logo.png",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
