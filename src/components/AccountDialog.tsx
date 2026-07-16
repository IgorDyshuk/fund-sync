import {
  Download,
  FileSpreadsheet,
  Languages,
  GraduationCap,
  LoaderCircle,
  LogOut,
  Mail,
  Settings2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createAnalyticsRange, type AnalyticsRange } from "../lib/monthlyAnalytics";
import { useI18n } from "../lib/I18nContext";
import type { AuthUserSummary } from "../types/auth";
import { AnalyticsTimeframeSheet } from "./AnalyticsTimeframeSheet";

type AccountDialogProps = {
  isOpen: boolean;
  user: AuthUserSummary;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
  onImportCsv?: (file: File) => Promise<void>;
  onExportCsv?: (range: AnalyticsRange) => void | string | Promise<void | string>;
  onOpenOnboarding?: () => void;
};

export function AccountDialog({
  isOpen,
  user,
  onClose,
  onLogout,
  onImportCsv,
  onExportCsv,
  onOpenOnboarding,
}: AccountDialogProps) {
  const { language, setLanguage, t } = useI18n();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExportTimeframeOpen, setIsExportTimeframeOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isBusy = isLoggingOut || isImporting;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy && !isExportTimeframeOpen) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, isExportTimeframeOpen, isOpen, onClose]);

  async function logout() {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function importCsv(file: File | undefined) {
    if (!file || !onImportCsv) {
      return;
    }

    setIsImporting(true);
    try {
      await onImportCsv(file);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-[95] grid place-items-center bg-black/75 p-[15px] transition-opacity duration-200 ease-out sm:p-6 ${
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={isBusy ? undefined : onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
        className={`flex max-h-[90svh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11141a] text-[#e7e9ee] shadow-2xl shadow-black transition-opacity duration-200 ease-out sm:min-h-[520px] ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10">
              <Settings2 className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h2
                id="account-dialog-title"
                className="text-xl font-semibold text-white sm:text-2xl"
              >
                {t("Настройки")}
              </h2>
              <p className="mt-0.5 text-xs text-[#929ca9] sm:text-sm">
                {t("Аккаунт, синхронизация и данные")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label={t("Закрыть настройки")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="px-4 py-5 sm:px-6 sm:py-6">
            <h3 className="text-base font-semibold text-white sm:text-lg">
              {t("Аккаунт")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#8f98a5] sm:text-sm">
              {t("Данные профиля и состояние облачной синхронизации.")}
            </p>

            <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                  <UserRound className="h-5 w-5 text-[#c8ced7]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-[#8f98a5]">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-white sm:text-base">
                    {user.email ?? t("Email не указан")}
                  </p>
                </div>
              </div>

              <div className="inline-flex w-fit items-center gap-2 text-xs font-medium text-emerald-200 sm:text-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.6)]" />
                {t("Синхронизация включена")}
              </div>
            </div>
          </section>

          {onImportCsv || onExportCsv ? (
            <section className="border-t border-white/10 px-4 py-5 sm:px-6 sm:py-6">
              <h3 className="text-base font-semibold text-white sm:text-lg">
                {t("Данные")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#8f98a5] sm:text-sm">
                {t("Управление историей связок и перенос данных.")}
              </p>

              {onImportCsv ? (
                <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white sm:text-base">
                        {t("Импорт истории")}
                      </p>
                      <p className="mt-0.5 text-xs text-[#8f98a5] sm:text-sm">
                        {t("Файл CSV с сохранёнными связками")}
                      </p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="sr-only"
                    aria-label={t("Выбрать CSV с историей")}
                    onChange={(event) => void importCsv(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                    className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.07] px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/[0.12] disabled:cursor-wait disabled:opacity-50 sm:w-auto"
                  >
                    {isImporting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {t(isImporting ? "Импортируем..." : "Импортировать CSV")}
                  </button>
                </div>
              ) : null}

              {onExportCsv ? (
                <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                      <Download className="h-4 w-4 text-cyan-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white sm:text-base">
                        {t("Экспорт истории")}
                      </p>
                      <p className="mt-0.5 text-xs text-[#8f98a5] sm:text-sm">
                        {t("CSV со связками за выбранный период")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsExportTimeframeOpen(true)}
                    disabled={isBusy}
                    className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.11] disabled:opacity-50 sm:w-auto"
                  >
                    <Download className="h-4 w-4" />
                    {t("Экспортировать")}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="border-t border-white/10 px-4 py-5 sm:px-6 sm:py-6">
            <h3 className="text-base font-semibold text-white sm:text-lg">
              {t("Язык")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#8f98a5] sm:text-sm">
              {t("Язык интерфейса приложения.")}
            </p>
            <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                  <Languages className="h-5 w-5 text-emerald-300" />
                </div>
                <span className="text-sm font-medium text-white sm:text-base">
                  {language === "en" ? "English" : "Русский"}
                </span>
              </div>
              <div
                role="group"
                aria-label={t("Язык")}
                className="grid grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1"
              >
                {(["ru", "en"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLanguage(option)}
                    aria-pressed={language === option}
                    className={`min-h-9 rounded-md px-3 text-sm font-semibold transition ${
                      language === option
                        ? "bg-white/10 text-white"
                        : "text-[#8f98a5] hover:text-white"
                    }`}
                  >
                    {option === "ru" ? t("Русский") : "English"}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {onOpenOnboarding ? (
            <section className="border-t border-white/10 px-4 py-5 sm:px-6 sm:py-6">
              <h3 className="text-base font-semibold text-white sm:text-lg">
                {t("Обучение")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#8f98a5] sm:text-sm">
                {t("Краткое знакомство с основными возможностями Fund Sync.")}
              </p>

              <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <GraduationCap className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white sm:text-base">
                      {t("Обзор приложения")}
                    </p>
                    <p className="mt-0.5 text-xs text-[#8f98a5] sm:text-sm">
                      {t("6 коротких шагов")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  disabled={isBusy}
                  className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-[#d6dbe2] transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50 sm:w-auto"
                >
                  {t("Пройти обучение")}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <footer className="border-t border-white/10 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => void logout()}
            disabled={isBusy}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-300/25 bg-red-500/10 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-50 sm:w-auto"
          >
            <LogOut className="h-4 w-4" />
            {t(isLoggingOut ? "Выходим..." : "Выйти из аккаунта")}
          </button>
        </footer>
      </section>

      {isExportTimeframeOpen && onExportCsv ? (
        <AnalyticsTimeframeSheet
          initialRange={createAnalyticsRange("month", new Date())}
          title={t("Экспорт истории")}
          applyLabel={t("Экспортировать CSV")}
          zIndexClassName="z-[110]"
          onApply={onExportCsv}
          onClose={() => setIsExportTimeframeOpen(false)}
        />
      ) : null}
    </div>
  );
}
