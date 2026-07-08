export type AppStatus = "idle" | "analyzing" | "review" | "result" | "error";

export type ConflictDraft = {
  choiceId: string;
  customValue: string;
};
