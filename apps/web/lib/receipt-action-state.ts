export interface SaveReceiptState {
  status: "idle" | "saved" | "error";
  message: string;
}

export const initialSaveReceiptState: SaveReceiptState = {
  status: "idle",
  message: "",
};

export interface RemoveReceiptState {
  status: "idle" | "removed" | "error";
  message: string;
}

export const initialRemoveReceiptState: RemoveReceiptState = {
  status: "idle",
  message: "",
};
