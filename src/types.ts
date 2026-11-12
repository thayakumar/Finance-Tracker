export interface Expense {
  date: string;
  item: string;
  amount: number;
  category: string;
  receiptName?: string;
  receiptUrl?: string;
  id?: string;
}

export enum Category {
  Transport = "Grab/Transport/Fuel/Parking",
  Groceries = "Groceries",
  Lifestyle = "Lifestyle",
  Entertainment = "Entertainment",
  Food = "Food",
  Unknown = "Unknown",
}

export interface AuthState {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  } | null;
  accessToken: string | null;
  needsAuth: boolean;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
}
