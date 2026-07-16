import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Cloud,
  FileText,
  Images,
  Plus,
  RotateCcw,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { cn } from "../utils/cn";
import { translate as t } from "../lib/i18n";

type OnboardingDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

type SlideKind =
  | "welcome"
  | "add"
  | "upload"
  | "result"
  | "analytics"
  | "sync";

type OnboardingSlide = {
  title: string;
  description: string;
  kind: SlideKind;
  icon: LucideIcon;
};

const slides: OnboardingSlide[] = [
  {
    title: "Добро пожаловать в Fund Sync",
    description:
      "Сохраняйте сделки, считайте общий результат связок и анализируйте прибыль по каждой монете.",
    kind: "welcome",
    icon: Sparkles,
  },
  {
    title: "Добавьте связку",
    description:
      "Кнопка «+» открывает анализатор. Связку можно распознать по скриншотам или добавить вручную.",
    kind: "add",
    icon: Plus,
  },
  {
    title: "Скриншоты и условия",
    description:
      "Загрузите все изображения одной сделки вместе. Текстовые уточнения имеют приоритет над распознанными данными.",
    kind: "upload",
    icon: Images,
  },
  {
    title: "Проверьте результат",
    description:
      "Сверьте стороны сделки, PnL, общий объём и спреды. Сохраните результат или запустите анализ повторно.",
    kind: "result",
    icon: CheckCircle2,
  },
  {
    title: "История и аналитика",
    description:
      "Просматривайте сохранённые сделки, результат по монетам и выбирайте день, месяц, квартал, год или свой период.",
    kind: "analytics",
    icon: BarChart3,
  },
  {
    title: "Аккаунт и синхронизация",
    description:
      "Войдите в аккаунт, чтобы история была доступна на всех устройствах. Обучение всегда можно открыть снова в настройках.",
    kind: "sync",
    icon: Cloud,
  },
];

export function OnboardingDialog({ isOpen, onClose }: OnboardingDialogProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">(
    "forward",
  );
  const touchStartXRef = useRef<number | null>(null);
  const slide = slides[slideIndex];
  const isFirstSlide = slideIndex === 0;
  const isLastSlide = slideIndex === slides.length - 1;

  const goToSlide = (nextIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(nextIndex, slides.length - 1));
    if (boundedIndex === slideIndex) {
      return;
    }
    setDirection(boundedIndex > slideIndex ? "forward" : "backward");
    setSlideIndex(boundedIndex);
  };

  const goForward = () => {
    if (isLastSlide) {
      onClose();
      return;
    }
    goToSlide(slideIndex + 1);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        goForward();
      } else if (event.key === "ArrowLeft") {
        goToSlide(slideIndex - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartXRef.current = null;
    if (startX === null || endX === undefined) {
      return;
    }

    const distance = startX - endX;
    if (Math.abs(distance) < 48) {
      return;
    }
    if (distance > 0) {
      goForward();
    } else {
      goToSlide(slideIndex - 1);
    }
  };

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-0 z-[110] grid place-items-center bg-black/80 p-[15px] transition-opacity duration-200 ease-out sm:p-6",
        isOpen
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
      )}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-dialog-title"
        className={cn(
          "flex max-h-[92svh] min-h-[min(680px,92svh)] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101319] text-[#e7e9ee] shadow-2xl shadow-black transition-[opacity,transform] duration-200 ease-out",
          isOpen ? "scale-100 opacity-100" : "scale-[0.985] opacity-0",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white sm:text-base">
            <img
              src={`${import.meta.env.BASE_URL}favicon-32.png`}
              alt=""
              className="h-7 w-7 rounded-lg"
            />
            Fund Sync
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xs font-medium text-[#aab3bf] transition hover:text-white sm:text-sm"
          >
            {t("Пропустить")}
          </button>
        </header>

        <div
          data-testid="onboarding-slide-viewport"
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 py-4 sm:px-7 sm:py-6"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            key={`${slideIndex}-${direction}`}
            className={cn(
              direction === "forward"
                ? "onboarding-slide-forward"
                : "onboarding-slide-backward",
            )}
          >
            <TutorialVisual kind={slide.kind} icon={slide.icon} />

            <div className="mx-auto mt-5 max-w-[540px] text-center sm:mt-7">
              <p className="text-xs font-semibold uppercase text-emerald-300">
                {t("Шаг {current} из {total}", {
                  current: slideIndex + 1,
                  total: slides.length,
                })}
              </p>
              <h2
                id="onboarding-dialog-title"
                className="mt-2 text-2xl font-semibold text-white sm:text-3xl"
              >
                {t(slide.title)}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#a9b1bd] sm:text-base sm:leading-7">
                {t(slide.description)}
              </p>
            </div>
          </div>
        </div>

        <footer className="border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-center gap-1.5" role="group" aria-label={t("Слайды обучения")}>
            {slides.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => goToSlide(index)}
                aria-label={t("Перейти к шагу {step}", { step: index + 1 })}
                aria-current={index === slideIndex ? "step" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color]",
                  index === slideIndex
                    ? "w-7 bg-emerald-300"
                    : "w-2.5 bg-white/15 hover:bg-white/30",
                )}
              />
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => goToSlide(slideIndex - 1)}
              disabled={isFirstSlide}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-semibold text-[#c0c7d1] transition hover:bg-white/[0.05] hover:text-white disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("Назад")}
            </button>
            <button
              type="button"
              onClick={goForward}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-3 text-sm font-semibold text-[#07110e] transition hover:bg-emerald-200"
            >
              {isLastSlide ? (
                <>
                  <Check className="h-4 w-4" />
                  {t("Начать работу")}
                </>
              ) : (
                <>
                  {t("Далее")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function TutorialVisual({
  kind,
  icon: Icon,
}: {
  kind: SlideKind;
  icon: LucideIcon;
}) {
  return (
    <div className="mx-auto flex h-[210px] w-full max-w-[500px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#090c11] p-4 sm:h-[250px] sm:p-6">
      {kind === "welcome" ? (
        <div className="text-center">
          <img
            src={`${import.meta.env.BASE_URL}icon-192.png`}
            alt=""
            className="mx-auto h-28 w-28 rounded-[28px] shadow-[0_0_36px_rgba(110,231,183,0.15)] sm:h-36 sm:w-36"
          />
        </div>
      ) : null}

      {kind === "add" ? (
        <div className="w-full max-w-[360px]">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-300 text-[#07110e] shadow-[0_0_28px_rgba(110,231,183,0.22)]">
            <Plus className="h-8 w-8" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <PreviewCommand icon={FileText} label={t("Вручную")} />
            <PreviewCommand icon={Sparkles} label={t("Анализировать")} primary />
          </div>
        </div>
      ) : null}

      {kind === "upload" ? (
        <div className="grid w-full max-w-[400px] gap-3 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-emerald-300/35 bg-emerald-300/[0.04] text-center">
            <div>
              <Images className="mx-auto h-7 w-7 text-emerald-300" />
              <p className="mt-2 text-xs font-medium text-[#d8dde4]">{t("Все скриншоты")}</p>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <FileText className="h-4 w-4 text-cyan-300" />
              {t("Условия")}
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-white/10" />
            <div className="mt-2 h-2 w-4/5 rounded-full bg-white/[0.07]" />
            <div className="mt-2 h-2 w-3/5 rounded-full bg-emerald-300/20" />
          </div>
        </div>
      ) : null}

      {kind === "result" ? (
        <div className="w-full max-w-[410px]">
          <div className="grid grid-cols-2 gap-3">
            <PreviewMetric label="Short" value="+319,44" positive />
            <PreviewMetric label="Long" value="-303,64" />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-300/25 bg-emerald-300/[0.08] px-4 py-3">
            <span className="text-xs text-[#aeb7c3]">{t("Итог по связке")}</span>
            <span className="text-lg font-semibold text-emerald-200">+15,80 USDT</span>
          </div>
          <div className="mt-3 flex justify-end gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 text-[#9aa4b1]">
              <RotateCcw className="h-3.5 w-3.5" /> {t("Повторить")}
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-200">
              <Check className="h-3.5 w-3.5" /> {t("Готово")}
            </span>
          </div>
        </div>
      ) : null}

      {kind === "analytics" ? (
        <div className="flex w-full max-w-[410px] items-center gap-5">
          <div className="relative h-28 w-28 shrink-0 rounded-full bg-[conic-gradient(#6ee7b7_0_46%,#67e8f9_46%_68%,#fca5a5_68%_100%)] p-4 sm:h-32 sm:w-32 sm:p-5">
            <div className="grid h-full w-full place-items-center rounded-full bg-[#090c11]">
              <BarChart3 className="h-7 w-7 text-emerald-300" />
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <PreviewCoin label="BTCUSDT" value="+63,00" color="bg-emerald-300" />
            <PreviewCoin label="INUSDT" value="+15,80" color="bg-cyan-300" />
            <PreviewCoin label="TAIKOUSDT" value="-10,00" color="bg-red-300" />
          </div>
        </div>
      ) : null}

      {kind === "sync" ? (
        <div className="w-full max-w-[390px]">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.05]">
              <UserRound className="h-5 w-5 text-[#cdd3dc]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#8f98a5]">{t("Ваш аккаунт")}</p>
              <div className="mt-1 h-2.5 w-36 max-w-full rounded-full bg-white/15" />
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-[#cfd5dd]">
              <Cloud className="h-5 w-5 text-cyan-300" />
              {t("Облачная история")}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {t("Включена")}
            </span>
          </div>
        </div>
      ) : null}

      {kind !== "welcome" ? (
        <Icon className="sr-only" aria-hidden="true" />
      ) : null}
    </div>
  );
}

function PreviewCommand({
  icon: Icon,
  label,
  primary = false,
}: {
  icon: LucideIcon;
  label: string;
  primary?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-lg border text-xs font-semibold",
        primary
          ? "border-emerald-300/30 bg-emerald-300/[0.1] text-emerald-100"
          : "border-white/10 text-[#b7c0cb]",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

function PreviewMetric({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3",
        positive
          ? "border-emerald-300/25 bg-emerald-300/[0.07]"
          : "border-red-300/25 bg-red-300/[0.07]",
      )}
    >
      <p className="text-[11px] text-[#909aa7]">{label}</p>
      <p
        className={cn(
          "mt-1 text-base font-semibold",
          positive ? "text-emerald-200" : "text-red-200",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PreviewCoin({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", color)} />
      <span className="min-w-0 flex-1 truncate text-[#d1d7df]">{label}</span>
      <span className="shrink-0 font-semibold text-white">{value}</span>
    </div>
  );
}
