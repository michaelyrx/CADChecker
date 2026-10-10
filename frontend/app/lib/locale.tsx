"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
export type Locale = "zh-CN" | "en";
type LocaleState = { locale: Locale; setLocale: (value: Locale) => void; t: (zh: string, en: string) => string };
const Context = createContext<LocaleState>({ locale: "zh-CN", setLocale: () => {}, t: zh => zh });
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setValue] = useState<Locale>("zh-CN");
  useEffect(() => { if (localStorage.getItem("cadlint.locale") === "en") setValue("en"); }, []);
  useEffect(() => { document.documentElement.lang = locale; document.title = locale === "en" ? "CADLint · Project workspace" : "CADLint · 项目工作界面"; }, [locale]);
  const setLocale = (value: Locale) => { setValue(value); localStorage.setItem("cadlint.locale", value); };
  return <Context.Provider value={{ locale, setLocale, t: (zh, en) => locale === "en" ? en : zh }}>{children}</Context.Provider>;
}
export const useLocale = () => useContext(Context);
