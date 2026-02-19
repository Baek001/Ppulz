export const ONBOARDING_STATES = Object.freeze({
  CATEGORIES_SELECTED: 'categories_selected',
  SUBCATEGORIES_SELECTED: 'subcategories_selected',
  EXAMPLES_DONE: 'examples_done',
  COMPLETED: 'completed',
});

export const MAX_BIG_CATEGORIES = 3;
export const MAX_SUB_CATEGORIES = 5;
export const MAX_EXAMPLE_CHECKED = 6;

export function isCompletedState(onboardingState) {
  return onboardingState === ONBOARDING_STATES.COMPLETED;
}

export function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}
