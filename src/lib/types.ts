export interface Clase {
  id: string;
  name: string;
  structure: string;
  exercises: string[];
  durationMinutes: number;
  createdAt: string;
}

export interface Idea {
  id: string;
  classId: string;
  content: string;
  model: string;
  focus?: string;
  createdAt: string;
}

/** Initializer for a new Clase — fill id + createdAt before persisting. */
export const EMPTY_CLASE: Omit<Clase, "id" | "createdAt"> = {
  name: "",
  structure: "",
  exercises: [],
  durationMinutes: 60,
};

/** Initializer for a new Idea — fill id + createdAt before persisting. */
export const EMPTY_IDEA: Omit<Idea, "id" | "createdAt"> = {
  classId: "",
  content: "",
  model: "MiniMax-M3",
};
