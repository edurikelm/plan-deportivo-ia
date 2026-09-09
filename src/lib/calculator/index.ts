export {
  BreakdownSchema,
  DiscRowSchema,
  RecordSourceSchema,
  SavedWeightRecordSchema,
  calculateBreakdownFromImage,
  crossCheckBreakdown,
  formatBreakdownLine,
  type Breakdown,
  type CalculatorState,
  type CrossCheckResult,
  type DiscRow,
  type RecordSource,
  type SavedWeightRecord,
  VISION_MODEL,
  VISION_SYSTEM_PROMPT,
} from "./schemas";
export {
  computeTotals,
  dedupeExercises,
  hashState,
  normalizeExerciseName,
  type ComputedTotals,
} from "./history";
export {
  aggregateExerciseOneRepMax,
  buildPrilepinRows,
  estimateOneRepMax,
  PRILEPIN_TABLE,
  type PrilepinRow,
} from "./one-rm";
export { getRecordsForExercise } from "./aggregate";
export {
  deriveExerciseIndex,
  type ExerciseIndexEntry,
} from "./exercise-index";
export { suggestRepsForExercise } from "./suggest-reps";
export {
  TYPICAL_EXERCISES,
  findTypicalByName,
  getTypicalExerciseNames,
  mergeTypicalAndHistory,
  type ExerciseCategory,
  type TypicalExercise,
} from "./typical-exercises";
export {
  addFavorite,
  isFavorite,
  removeFavorite,
  toggleFavorite,
} from "./favorites";
export {
  resolveWeight,
  DEFAULT_INVENTORY_KG,
  DEFAULT_INVENTORY_LB,
  type ResolveInput,
  type ResolveResult,
  type ResolvedLoad,
  type ResolveStatus,
  type InventoryUnit,
} from "./resolver";
