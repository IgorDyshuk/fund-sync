import { KeyRound, LogIn, UserPlus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { getAuthErrorMessage } from "../lib/authErrors";
import { isFirebaseConfigured } from "../lib/firebaseEnv";
import { cn } from "../utils/cn";

type AuthDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  firebaseConfigured?: boolean;
};

type AuthMode = "login" | "register";

export function AuthDialog({
  isOpen,
  onClose,
  onAuthenticated,
  firebaseConfigured = isFirebaseConfigured,
}: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === "register" && password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setIsBusy(true);
    try {
      const cloudSync = await import("../lib/cloudSync");
      if (mode === "register") {
        await cloudSync.registerWithEmail(email, password);
      } else {
        await cloudSync.loginWithEmail(email, password);
      }
      onAuthenticated();
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsBusy(false);
    }
  }

  async function continueWithGoogle() {
    setError(null);
    setIsBusy(true);
    try {
      const cloudSync = await import("../lib/cloudSync");
      await cloudSync.loginWithGoogle();
      onAuthenticated();
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsBusy(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
  }

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4 transition-opacity duration-200 ease-out ${
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        className={`w-full max-w-md rounded-xl border border-white/10 bg-[#11141a] p-4 text-[#e7e9ee] shadow-2xl shadow-black transition-opacity duration-200 ease-out sm:p-5 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10">
              <KeyRound className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h2 id="auth-dialog-title" className="text-lg font-semibold text-white">
                {mode === "login" ? "Войти в аккаунт" : "Создать аккаунт"}
              </h2>
              <p className="mt-1 text-sm text-[#aeb7c3]">
                История связок будет доступна на всех устройствах.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {!firebaseConfigured ? (
          <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            Firebase пока не настроен. Добавь `VITE_FIREBASE_*` переменные из
            Firebase Console в `.env` или Vercel Environment Variables.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void continueWithGoogle()}
              disabled={isBusy}
              aria-label="Продолжить с Google"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-50"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold text-[#15171c]">
                G
              </span>
              {isBusy ? "Подключение..." : "Продолжить с Google"}
            </button>

            <div className="my-4 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-[#737d89]">или по email</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition",
                  mode === "login"
                    ? "bg-white/[0.1] text-white"
                    : "text-[#9aa3af] hover:text-white",
                )}
              >
                <LogIn className="h-4 w-4" />
                Войти
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition",
                  mode === "register"
                    ? "bg-white/[0.1] text-white"
                    : "text-[#9aa3af] hover:text-white",
                )}
              >
                <UserPlus className="h-4 w-4" />
                Регистрация
              </button>
            </div>

            <form className="mt-4 grid gap-3" onSubmit={submit}>
              <label className="grid gap-1.5 text-sm text-[#cfd5de]">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="min-h-11 rounded-lg border border-white/10 bg-[#0b0d12] px-3 text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
                />
              </label>
              <label className="grid gap-1.5 text-sm text-[#cfd5de]">
                Пароль
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={6}
                  required
                  className="min-h-11 rounded-lg border border-white/10 bg-[#0b0d12] px-3 text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
                />
              </label>
              {mode === "register" ? (
                <label className="grid gap-1.5 text-sm text-[#cfd5de]">
                  Повтори пароль
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="min-h-11 rounded-lg border border-white/10 bg-[#0b0d12] px-3 text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
                  />
                </label>
              ) : null}

              {error ? (
                <div role="alert" className="rounded-lg border border-red-300/25 bg-red-500/15 p-3 text-sm text-red-100">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isBusy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07110c] transition hover:bg-emerald-200 disabled:bg-white/10 disabled:text-white/40"
              >
                {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {isBusy
                  ? "Подожди..."
                  : mode === "login"
                    ? "Войти"
                    : "Создать аккаунт"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
