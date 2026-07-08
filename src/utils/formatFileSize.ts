export function formatFileSize(file: File) {
  const kilobytes = file.size / 1024;
  if (kilobytes < 1024) {
    return `${Math.max(1, Math.round(kilobytes))} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
