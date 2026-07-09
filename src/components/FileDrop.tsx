import { type ChangeEvent } from "react";
import { FileImage, UploadCloud, X } from "lucide-react";
import { cn } from "../utils/cn";
import { formatFileSize } from "../utils/formatFileSize";

type FileDropProps = {
  title: string;
  files: File[];
  inputName: string;
  accent: "emerald" | "cyan";
  description?: string;
  onFilesChange: (files: File[]) => void;
};

export function FileDrop({
  title,
  files,
  inputName,
  accent,
  description,
  onFilesChange,
}: FileDropProps) {
  const inputId = `${inputName}-images`;
  const accentClasses =
    accent === "emerald"
      ? "border-emerald-300/25 hover:border-emerald-300/60 text-emerald-200"
      : "border-cyan-300/25 hover:border-cyan-300/60 text-cyan-200";

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    onFilesChange([...files, ...nextFiles]);
    event.target.value = "";
  }

  function removeFile(indexToRemove: number) {
    onFilesChange(files.filter((_, index) => index !== indexToRemove));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-[#dce2ea] lg:text-[13px]">
          <FileImage className="h-4 w-4 text-[#a7b0bd]" />
          {title}
        </span>
        <span className="text-xs text-[#8a93a0]">{files.length}</span>
      </div>
      {description ? (
        <p className="text-xs leading-5 text-[#8a93a0] lg:leading-[1.45]">
          {description}
        </p>
      ) : null}
      <label
        htmlFor={inputId}
        className={cn(
          "flex min-h-20 items-center justify-center rounded-lg border border-dashed bg-[#0b0d12] px-4 py-3 text-center transition lg:min-h-[72px]",
          accentClasses,
        )}
      >
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={addFiles}
        />
        <span className="flex items-center gap-2 text-sm font-medium">
          <UploadCloud className="h-5 w-5" />
          Выбрать изображения
        </span>
      </label>

      {files.length > 0 ? (
        <div className="grid gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="flex min-h-9 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm"
            >
              <span className="min-w-0 truncate text-[#dce2ea]">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-[#8a93a0]">
                {formatFileSize(file)}
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#8a93a0] transition hover:bg-white/10 hover:text-white"
                aria-label={`Удалить ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
