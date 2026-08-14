import type { Metadata } from "next";
import { PiStudio } from "../studio";

export const metadata: Metadata = {
  title: "劳博士",
  description: "劳博士的响应式嵌入式对话界面。",
};

export default function ChatWidgetPage() {
  return <PiStudio mode="chat-widget" />;
}
