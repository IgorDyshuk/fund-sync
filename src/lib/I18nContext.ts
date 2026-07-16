import { createContext, useContext } from "react";
import {
  getAppLanguage,
  getAppLocale,
  setAppLanguage,
  translate,
  type AppLanguage,
} from "./i18n";

export type I18nContextValue = {
  language: AppLanguage;
  locale: string;
  setLanguage: (language: AppLanguage) => void;
  t: typeof translate;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n() {
  const context = useContext(I18nContext);
  return context ?? {
    language: getAppLanguage(),
    locale: getAppLocale(),
    setLanguage: setAppLanguage,
    t: translate,
  };
}
