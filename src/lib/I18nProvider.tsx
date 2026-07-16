import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getAppLanguage,
  setAppLanguage,
  translate,
  type AppLanguage,
} from "./i18n";
import { I18nContext, type I18nContextValue } from "./I18nContext";


export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(getAppLanguage);

  useEffect(() => {
    setAppLanguage(language);
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setAppLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    locale: language === "en" ? "en-US" : "ru-RU",
    setLanguage,
    t: translate,
  }), [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
