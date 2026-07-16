import type { AppStatus } from "../types/app";
import { translate as t } from "../lib/i18n";

export function StatusPill({ status }: { status: AppStatus }) {
  const labelByStatus: Record<AppStatus, string> = {
    idle: "Готов",
    analyzing: "Анализ",
    review: "Проверка",
    result: "Итог",
    error: "Ошибка",
  };

  return (
    <span className="inline-flex h-8 items-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-[#b9c0ca] lg:h-7 lg:px-2.5">
      {t(labelByStatus[status])}
    </span>
  );
}
