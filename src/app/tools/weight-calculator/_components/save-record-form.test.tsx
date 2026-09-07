/**
 * Component tests for `SaveRecordForm` (issue 0037 + issue 0043).
 *
 * Covers the new fields (`Repeticiones` input + `Marcar como 1RM` checkbox),
 * the disabled state when `reps` is invalid, the payload passed to
 * `onSaved` on submit, the typical-exercise chip row, and the datalist
 * enrichment that ships with the chip row. Uses the project pattern
 * (render + userEvent), not the red-green TDD cycle reserved for pure
 * helpers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveRecordForm } from "./save-record-form";
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

  it("renders the three inputs (Ejercicio, Repeticiones, Marcar como 1RM)", () => {
    render(<SaveRecordForm {...defaultProps} />);

    // Ejercicio input is the only text input (with placeholder "Ej. Back Squat").
    expect(screen.getByPlaceholderText("Ej. Back Squat")).toBeInTheDocument();

    // Repeticiones is a number input. The initial value is 1 (the no-data
    // default of `suggestRepsForExercise`).
    const repsInput = screen.getByLabelText("Repeticiones") as HTMLInputElement;
    expect(repsInput).toBeInTheDocument();
    expect(repsInput.type).toBe("number");
    expect(repsInput.value).toBe("1");

    // Checkbox is unchecked by default.
    const flagCheckbox = screen.getByLabelText(
      "Marcar como 1RM",
    ) as HTMLInputElement;
    expect(flagCheckbox).toBeInTheDocument();
    expect(flagCheckbox.type).toBe("checkbox");
    expect(flagCheckbox.checked).toBe(false);
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

    // Try to submit anyway — the form's defensive guard prevents it.
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
      "Press militar",
    );
    const flagCheckbox = screen.getByLabelText(
      "Marcar como 1RM",
    ) as HTMLInputElement;
    await user.click(flagCheckbox);
    expect(flagCheckbox.checked).toBe(true);

    await user.click(screen.getByRole("button", { name: "Guardar carga" }));

    expect(defaultProps.onSaved).toHaveBeenCalledTimes(1);
    const record = defaultProps.onSaved.mock.calls[0][0];
    expect(record.exercise).toBe("Press militar");
    expect(record.isOneRepMax).toBe(true);
  });
});

describe("SaveRecordForm — issue 0043 typical-exercise chips", () => {
  beforeEach(() => {
    resetLocalStorage();
    defaultProps.onSaved.mockReset();
    defaultProps.onCancel.mockReset();
  });

  afterEach(cleanup);

  it("renders the typical-exercise chip group", () => {
    render(<SaveRecordForm {...defaultProps} />);
    expect(
      screen.getByRole("group", { name: "Ejercicios típicos" }),
    ).toBeInTheDocument();
  });

  it("surfaces the six most common movements as chips (AC requirement)", () => {
    render(<SaveRecordForm {...defaultProps} />);
    const group = screen.getByRole("group", { name: "Ejercicios típicos" });
    for (const required of [
      "Sentadilla trasera",
      "Peso muerto convencional",
      "Press banca",
      "Press militar",
      "Remo con barra",
      "Dominada",
    ]) {
      expect(
        within(group).getByRole("button", {
          name: `Seleccionar ${required}`,
        }),
      ).toBeInTheDocument();
    }
  });

  it("clicking a chip fills the input with the canonical Spanish name", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    const chip = screen.getByRole("button", {
      name: "Seleccionar Press banca",
    });
    await user.click(chip);

    const exerciseInput = screen.getByPlaceholderText(
      "Ej. Back Squat",
    ) as HTMLInputElement;
    expect(exerciseInput.value).toBe("Press banca");
  });

  it("highlights the chip whose name matches the input (active state)", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    // Type a name that matches a typical, case-insensitive.
    const exerciseInput = screen.getByPlaceholderText("Ej. Back Squat");
    await user.type(exerciseInput, "press BANCA");

    const chip = screen.getByRole("button", {
      name: "Seleccionar Press banca",
    });
    expect(chip).toHaveAttribute("data-active", "true");
    expect(chip).toHaveAttribute("aria-pressed", "true");

    // Sanity: an unrelated chip is NOT active.
    const otherChip = screen.getByRole("button", {
      name: "Seleccionar Dominada",
    });
    expect(otherChip).toHaveAttribute("data-active", "false");
    expect(otherChip).toHaveAttribute("aria-pressed", "false");
  });

  it("does NOT highlight any chip for a freeform (non-catalog) name", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    const exerciseInput = screen.getByPlaceholderText("Ej. Back Squat");
    await user.type(exerciseInput, "Pull-through con banda");

    const group = screen.getByRole("group", { name: "Ejercicios típicos" });
    // We use `data-active` (which is a stable test hook the chip
    // component sets unconditionally) instead of
    // `getAllByRole("button", { pressed: true })`. The ARIA role matcher
    // has subtle behavior when zero elements match the filter and is
    // harder to keep stable across testing-library versions.
    const allChips = within(group).getAllByRole("button");
    const activeChips = allChips.filter(
      (b) => b.getAttribute("data-active") === "true",
    );
    expect(activeChips).toHaveLength(0);
  });

  it("seeds the datalist with the typical names (autocomplete on type)", () => {
    render(<SaveRecordForm {...defaultProps} />);
    const exerciseInput = screen.getByPlaceholderText("Ej. Back Squat");
    const datalistId = exerciseInput.getAttribute("list");
    expect(datalistId).toBeTruthy();
    const datalist = document.getElementById(datalistId as string);
    expect(datalist).toBeTruthy();
    const options = Array.from(datalist!.querySelectorAll("option")).map(
      (o) => (o as HTMLOptionElement).value,
    );
    // Spot-check a handful of typical names — exhaustive coverage lives
    // in typical-exercises.test.ts.
    for (const required of [
      "Sentadilla trasera",
      "Press banca",
      "Dominada",
      "Press militar",
    ]) {
      expect(options).toContain(required);
    }
  });

  it("persists the canonical Spanish name when submitted via a chip", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    // Click the chip instead of typing the name.
    await user.click(
      screen.getByRole("button", { name: "Seleccionar Peso muerto convencional" }),
    );

    // reps defaults to 1 from suggestRepsForExercise with no history.
    await user.click(screen.getByRole("button", { name: "Guardar carga" }));

    expect(defaultProps.onSaved).toHaveBeenCalledTimes(1);
    const record = defaultProps.onSaved.mock.calls[0][0];
    expect(record.exercise).toBe("Peso muerto convencional");
  });

  it("still accepts a freeform name not in the typical catalog", async () => {
    const user = userEvent.setup();
    render(<SaveRecordForm {...defaultProps} />);

    await user.type(
      screen.getByPlaceholderText("Ej. Back Squat"),
      "Pull-through con banda",
    );
    await user.click(screen.getByRole("button", { name: "Guardar carga" }));

    expect(defaultProps.onSaved).toHaveBeenCalledTimes(1);
    const record = defaultProps.onSaved.mock.calls[0][0];
    expect(record.exercise).toBe("Pull-through con banda");
  });
});
