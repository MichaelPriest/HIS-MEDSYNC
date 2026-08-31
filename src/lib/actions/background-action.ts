export type BackgroundActionStatus = "idle" | "success" | "error";

export type BackgroundActionState<T = undefined> = {
  status: BackgroundActionStatus;
  code?: string;
  message?: string;
  detail?: string;
  data?: T;
};

export const INITIAL_BACKGROUND_ACTION_STATE: BackgroundActionState = {
  status: "idle",
};
