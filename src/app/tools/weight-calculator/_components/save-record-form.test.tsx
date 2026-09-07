/**
 * Component tests for `SaveRecordForm` (issue 0037 + 0043 + 0044).
 *
 * Covers the form fields (Ejercicio, Repeticiones, Marcar como 1RM,
 * Marcar como favorito), the disabled state when `reps` is invalid, the
 * payload passed to `onSaved` on submit, the favorite-exercise chip row,
 * the datalist enrichment that ships with the chip row, and the
 * add/remove favorite behavior driven by the form's checkbox and the
 * chip's `×` button.
 *
 * Uses the project pattern (render + userEvent), not the red-green TDD
 * cycle reserved for pure helpers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveRecordForm } from "./save-record-form";
import { addFavorite, getFavorites } from "@/lib/storage";
import { resetLocalStorage } from "../../../../../vitest.setup";

// ─── Default props ───────────────────────────────────────────────────────────

const defaultProps = {
  currentState: { barKg: 20, discs: [] },
  onSaved: vi.fn(),
  onCancel: vi.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SaveRecordForm — issue 0037 fields", () => {
  beforeEach(() => {
    resetLocalStorage();
    defaultProps.onSaved.mockReset();
    defaultProps.onCancel.mockReset();
  });

  // Explicit cleanup is a safety net so multiple inputs from previous
  // renders don't leak into the next test's `getBy*` queries.
  afterEach(cleanup);

  it("renders the inputs and checkboxes (Ejercicio, Repeticiones, 1RM, Favorito)", () => {
    render(<SaveRecordForm {...defaultProps} />);

    expect(screen.getByPlaceholderText("Ej. Back Squat")).toBeInTheDocument();

    const repsInput = screen.getByLabelText("Repeticiones") as HTMLInputElement;
    expect(repsInput).toBeInTheDocument();
    expect(repsInput.type).toBe("number");
    expect(repsInput.value).toBe("1");

    const flagCheckbox = screen.getByLabelText(
      "Marcar como 1RM",
    ) as HTMLInputElement;
    expect(flagCheckbox).toBeInTheDocument();
    expect(flagCheckbox.type).toBe("checkbox");
    expect(flagCheckbox.checked).toBe(false);

    const favoriteCheckbox = screen.getByLabelText(
      "Marcar como favorito",
    ) as HTMLInputElement;
    expect(favoriteCheckbox).toBeInTheDocument();
    expect(favoriteCheckbox.type).toBe("checkbox");
    expect(favoriteCheckbox.checked).toBe(false);
  });

  it("does not call onSaved when reps is 0 (submit button stays disabled)", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    const exerciseInput = screen.getByPlaceholderText("Ej. Back Squat");
    const repsInput = screen.getByLabelText("Repeticiones") as HTMLInputElement;

    await user.type(exerciseInput, "Back Squat");
    await user.clear(repsInput);
    await user.type(repsInput, "0");

    const submitButton = screen.getByRole("button", { name: "Guardar carga" });
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(defaultProps.onSaved).not.toHaveBeenCalled();
  });

  it("persists with reps=5 and isOneRepMax=false on submit", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Ej. Back Squat"),
      "Back Squat",
    );
    const repsInput = screen.getByLabelText("Repeticiones") as HTMLInputElement;
    await user.clear(repsInput);
    await user.type(repsInput, "5");

    await user.click(screen.getByRole("button", { name: "Guardar carga" }));

    expect(defaultProps.onSaved).toHaveBeenCalledTimes(1);
    const record = defaultProps.onSaved.mock.calls[0][0];
    expect(record.exercise).toBe("Back Squat");
    expect(record.reps).toBe(5);
    expect(record.isOneRepMax).toBe(false);
    expect(record.source).toBe("manual");
    expect(typeof record.id).toBe("string");
    expect(typeof record.createdAt).toBe("string");
  });

  it("persists with isOneRepMax=true when the Marcar como 1RM checkbox is checked", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Ej. Back Squat"),
      "Overhead Press",
    );
    const flagCheckbox = screen.getByLabelText(
      "Marcar como 1RM",
    ) as HTMLInputElement;
    await user.click(flagCheckbox);
    expect(flagCheckbox.checked).toBe(true);

    await user.click(screen.getByRole("button", { name: "Guardar carga" }));

    expect(defaultProps.onSaved).toHaveBeenCalledTimes(1);
    const record = defaultProps.onSaved.mock.calls[0][0];
    expect(record.exercise).toBe("Overhead Press");
    expect(record.isOneRepMax).toBe(true);
  });

  it("shows a loading state on the Guardar button while the save is in flight (0045 M1)", async () => {
    const user = userEvent.setup();
    // The default onSaved mock does NOT unmount the form, so the form
    // stays mounted in `submitting: true` state right after the click.
    // This lets us observe the loading affordance without faking timers.
    render(<SaveRecordForm {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Ej. Back Squat"),
      "Back Squat",
    );
    await user.click(screen.getByRole("button", { name: "Guardar carga" }));

    // The submit handler flips `submitting` synchronously and calls
    // onSaved in the same tick. React 18 batches and re-renders, so by
    // the time the next assertion runs, the form is in loading state.
    const loadingButton = screen.getByRole("button", {
      name: "Guardando carga",
    });
    expect(loadingButton).toBeInTheDocument();
    expect(loadingButton).toBeDisabled();
    // The icon swap is part of the contract — Loader2 with animate-spin
    // replaced the idle BookmarkPlus. We check by className presence on
    // the svg child.
    expect(loadingButton.querySelector(".animate-spin")).toBeInTheDocument();
    // The save still fires once with the right data.
    expect(defaultProps.onSaved).toHaveBeenCalledTimes(1);
    const record = defaultProps.onSaved.mock.calls[0][0];
    expect(record.exercise).toBe("Back Squat");
  });
});

// ─── Issue 0044 — favorite-exercise chip row + Marcar como favorito ──────────

describe("SaveRecordForm — issue 0044 favorites", () => {
  beforeEach(() => {
    resetLocalStorage();
    defaultProps.onSaved.mockReset();
    defaultProps.onCancel.mockReset();
  });

  afterEach(cleanup);

  it("does NOT render the chip row when there are no favorites", () => {
    render(<SaveRecordForm {...defaultProps} />);
    expect(
      screen.queryByRole("group", { name: "Ejercicios favoritos" }),
    ).not.toBeInTheDocument();
  });

  it("renders the chip row with the coach's favorites (one chip per favorite)", () => {
    // Seed two favorites before opening the form. The chip row reads the
    // storage state once at mount, so seeds placed before render are
    // picked up.
    addFavorite("Back Squat");
    addFavorite("Bench Press");

    render(<SaveRecordForm {...defaultProps} />);

    const group = screen.getByRole("group", { name: "Ejercicios favoritos" });
    expect(
      within(group).getByRole("button", { name: "Seleccionar Back Squat" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: "Seleccionar Bench Press" }),
    ).toBeInTheDocument();
  });

  it("clicking a chip fills the input with the favorite name", async () => {
    addFavorite("Conventional Deadlift");
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    const chip = screen.getByRole("button", {
      name: "Seleccionar Conventional Deadlift",
    });
    await user.click(chip);

    const exerciseInput = screen.getByPlaceholderText(
      "Ej. Back Squat",
    ) as HTMLInputElement;
    expect(exerciseInput.value).toBe("Conventional Deadlift");
  });

  it("highlights the chip whose name matches the input (active state)", async () => {
    addFavorite("Back Squat");
    addFavorite("Bench Press");
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    const exerciseInput = screen.getByPlaceholderText("Ej. Back Squat");
    await user.type(exerciseInput, "BACK squat");

    // The chip body button reflects the active state via `aria-pressed`
    // (the accessibility contract); `data-active` lives on the wrapper
    // span that the test reaches via `closest()` to avoid coupling to
    // the inner DOM layout.
    const matching = screen.getByRole("button", {
      name: "Seleccionar Back Squat",
    });
    expect(matching).toHaveAttribute("aria-pressed", "true");
    expect(matching.closest("[data-active]")).toHaveAttribute(
      "data-active",
      "true",
    );

    const other = screen.getByRole("button", {
      name: "Seleccionar Bench Press",
    });
    expect(other).toHaveAttribute("aria-pressed", "false");
    expect(other.closest("[data-active]")).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  it("clicking the chip's × removes the favorite from storage and from the row", async () => {
    addFavorite("Back Squat");
    addFavorite("Bench Press");
    expect(getFavorites()).toEqual(["Bench Press", "Back Squat"]);

    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    const removeButton = screen.getByRole("button", {
      name: "Quitar Back Squat de favoritos",
    });
    await user.click(removeButton);

    // Storage is updated.
    expect(getFavorites()).toEqual(["Bench Press"]);
    // The chip disappears from the row.
    expect(
      screen.queryByRole("button", { name: "Seleccionar Back Squat" }),
    ).not.toBeInTheDocument();
    // The other chip stays.
    expect(
      screen.getByRole("button", { name: "Seleccionar Bench Press" }),
    ).toBeInTheDocument();
  });

  it("clicking the chip's × does NOT fill the input (stopPropagation)", async () => {
    addFavorite("Back Squat");
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    const removeButton = screen.getByRole("button", {
      name: "Quitar Back Squat de favoritos",
    });
    await user.click(removeButton);

    const exerciseInput = screen.getByPlaceholderText(
      "Ej. Back Squat",
    ) as HTMLInputElement;
    // The input stays empty — only the favorite is removed.
    expect(exerciseInput.value).toBe("");
  });

  it("pre-checks the favorite checkbox when the defaultExercise is already a favorite", () => {
    addFavorite("Back Squat");
    render(<SaveRecordForm {...defaultProps} defaultExercise="Back Squat" />);

    const favoriteCheckbox = screen.getByLabelText(
      "Marcar como favorito",
    ) as HTMLInputElement;
    expect(favoriteCheckbox.checked).toBe(true);
  });

  it("does NOT pre-check the favorite checkbox when defaultExercise is not a favorite", () => {
    addFavorite("Back Squat");
    render(<SaveRecordForm {...defaultProps} defaultExercise="Bench Press" />);

    const favoriteCheckbox = screen.getByLabelText(
      "Marcar como favorito",
    ) as HTMLInputElement;
    expect(favoriteCheckbox.checked).toBe(false);
  });

  it("persists the exercise as a favorite when the checkbox is checked on submit", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Ej. Back Squat"),
      "Incline Bench Press",
    );
    await user.click(screen.getByLabelText("Marcar como favorito"));
    await user.click(screen.getByRole("button", { name: "Guardar carga" }));

    expect(getFavorites()).toEqual(["Incline Bench Press"]);
    expect(defaultProps.onSaved).toHaveBeenCalledTimes(1);
  });

  it("removes the exercise from favorites when the checkbox is unchecked on submit AND it was already a favorite", async () => {
    addFavorite("Back Squat");
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} defaultExercise="Back Squat" />);

    // Checkbox is pre-checked (Back Squat is a favorite). Uncheck it.
    const favoriteCheckbox = screen.getByLabelText(
      "Marcar como favorito",
    ) as HTMLInputElement;
    expect(favoriteCheckbox.checked).toBe(true);
    await user.click(favoriteCheckbox);
    expect(favoriteCheckbox.checked).toBe(false);

    await user.click(screen.getByRole("button", { name: "Guardar carga" }));

    // The record is still saved — unchecking only affects favorites.
    expect(defaultProps.onSaved).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSaved.mock.calls[0][0].exercise).toBe(
      "Back Squat",
    );
    // But the favorite is removed.
    expect(getFavorites()).toEqual([]);
  });

  it("does NOT add the exercise to favorites when the checkbox stays unchecked on submit", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Ej. Back Squat"),
      "Back Squat",
    );
    // Checkbox is unchecked by default; leave it that way.
    await user.click(screen.getByRole("button", { name: "Guardar carga" }));

    expect(getFavorites()).toEqual([]);
  });

  it("seeds the datalist with English catalog names (autocomplete on type)", () => {
    render(<SaveRecordForm {...defaultProps} />);
    const exerciseInput = screen.getByPlaceholderText("Ej. Back Squat");
    const datalistId = exerciseInput.getAttribute("list");
    expect(datalistId).toBeTruthy();
    const datalist = document.getElementById(datalistId as string);
    expect(datalist).toBeTruthy();
    const options = Array.from(datalist!.querySelectorAll("option")).map(
      (o) => (o as HTMLOptionElement).value,
    );
    for (const required of [
      "Back Squat",
      "Bench Press",
      "Conventional Deadlift",
      "Overhead Press",
      "Barbell Row",
      "Pull-up",
    ]) {
      expect(options).toContain(required);
    }
    // Sanity: no Spanish leftovers from 0043.
    expect(options).not.toContain("Sentadilla trasera");
    expect(options).not.toContain("Press banca");
  });

  it("still accepts a freeform name not in the catalog or favorites", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Ej. Back Squat"),
      "Pull-through with band",
    );
    await user.click(screen.getByRole("button", { name: "Guardar carga" }));

    expect(defaultProps.onSaved).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSaved.mock.calls[0][0].exercise).toBe(
      "Pull-through with band",
    );
  });
});
