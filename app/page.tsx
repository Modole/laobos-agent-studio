import type { Metadata } from "next";
import { PiStudio } from "./studio";

export const metadata: Metadata = {
  title: "劳博士 — Agent 客户端",
  description: "劳博士 Agent 的本地优先对话与配置工作台。",
};

export default function Home() {
  return <PiStudio />;
}
