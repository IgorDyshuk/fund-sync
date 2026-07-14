import { Plus } from "lucide-react";

type FloatingAddButtonProps = {
  onClick: () => void;
};

export function FloatingAddButton({ onClick }: FloatingAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Добавить связку"
      className="fixed bottom-4 right-4 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-300 text-[#07110c] shadow-[0_0_28px_rgba(110,231,183,0.28)] transition hover:bg-emerald-200 active:scale-95 sm:bottom-6 sm:right-6"
    >
      <Plus className="h-7 w-7" />
    </button>
  );
}
