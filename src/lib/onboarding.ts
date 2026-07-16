export const onboardingStorageKey = "fund-sync:onboarding:v1";

type OnboardingStorage = Pick<Storage, "getItem" | "setItem">;

export function hasCompletedOnboarding(storage?: OnboardingStorage) {
  const target = storage ?? getBrowserStorage();
  if (!target) {
    return true;
  }

  try {
    return target.getItem(onboardingStorageKey) === "completed";
  } catch {
    return true;
  }
}

export function markOnboardingCompleted(storage?: OnboardingStorage) {
  const target = storage ?? getBrowserStorage();
  if (!target) {
    return;
  }

  try {
    target.setItem(onboardingStorageKey, "completed");
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function getBrowserStorage(): OnboardingStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}
