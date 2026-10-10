import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LocaleProvider } from "./lib/locale";
export const metadata: Metadata = { title: "CADLint · 项目工作界面", description: "基于矢量 PDF 的图纸检查" };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) { return <html lang="zh-CN"><body><LocaleProvider>{children}</LocaleProvider></body></html>; }
