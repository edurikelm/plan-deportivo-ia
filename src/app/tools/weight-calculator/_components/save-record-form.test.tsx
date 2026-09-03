/**
 * Component tests for `SaveRecordForm` (issue 0037).
 *
 * Covers the new fields (`Repeticiones` input + `Marcar como 1RM` checkbox),
 * the disabled state when `reps` is invalid, and the payload passed to
 * `onSaved` on submit. Uses the project pattern (render + userEvent), not
 * the red-green TDD cycle reserved for pure helpers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
