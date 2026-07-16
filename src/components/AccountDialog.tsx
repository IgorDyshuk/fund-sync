import { FileSpreadsheet, LoaderCircle, LogOut, Mail, Upload, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AuthUserSummary } from "../types/auth";

type AccountDialogProps = {
  isOpen: boolean;
  user: AuthUserSummary;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
  onImportCsv?: (file: File) => Promise<void>;
};

export function AccountDialog({
  isOpen,
  user,
  onClose,
  onLogout,
  onImportCsv,
}: AccountDialogProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isBusy = isLoggingOut || isImporting;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, isOpen, onClose]);

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
      className={`fixed inset-0 z-[95] grid place-items-center bg-black/75 p-4 transition-opacity duration-200 ease-out ${
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={isBusy ? undefined : onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
        className={`w-full max-w-sm rounded-xl border border-white/10 bg-[#11141a] p-4 text-[#e7e9ee] shadow-2xl shadow-black transition-opacity duration-200 ease-out sm:p-5 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/10">
              <UserRound className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h2 id="account-dialog-title" className="text-lg font-semibold text-white">
                Личный кабинет
              </h2>
              <p className="mt-0.5 text-xs text-[#929ca9]">
                Синхронизация включена
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Закрыть личный кабинет"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="mt-5 flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-black/15 px-3 py-3">
          <Mail className="h-4 w-4 shrink-0 text-[#8f98a5]" />
          <div className="min-w-0">
            <p className="text-xs text-[#8f98a5]">Email</p>
            <p className="mt-0.5 truncate text-sm font-medium text-white">
              {user.email ?? "Email не указан"}
            </p>
          </div>
        </div>

        {onImportCsv ? (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.025] p-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/15">
                <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">История из таблицы</p>
                <p className="mt-0.5 text-xs text-[#8f98a5]">Файл CSV из Google Таблиц</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              aria-label="Выбрать CSV с историей"
              onChange={(event) => void importCsv(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.07] px-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/[0.12] disabled:cursor-wait disabled:opacity-50"
            >
              {isImporting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {isImporting ? "Импортируем..." : "Импортировать CSV"}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void logout()}
          disabled={isBusy}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-300/25 bg-red-500/10 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Выходим..." : "Выйти из аккаунта"}
        </button>
      </section>
    </div>
  );
}
