export interface SaveReceiptState {
  status: "idle" | "saved" | "error";
  message: string;
}

export const initialSaveReceiptState: SaveReceiptState = {
  status: "idle",
  message: "",
};
