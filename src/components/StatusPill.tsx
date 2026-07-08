import type { AppStatus } from "../types/app";

export function StatusPill({ status }: { status: AppStatus }) {
  const labelByStatus: Record<AppStatus, string> = {
    idle: "Готов",
    analyzing: "API",
    review: "Review",
    result: "Result",
    error: "Error",
  };

  return (
    <span className="inline-flex h-8 items-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-[#b9c0ca]">
      {labelByStatus[status]}
    </span>
  );
}
