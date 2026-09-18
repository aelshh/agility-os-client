import { createContext, useContext } from "react";

export type UserRole =
  | "practitioner"
  | "field_coach"
  | "content_curator"
  | "quality_gate"
  | "strategist"
  | "architect"
  | "talent_steward";

export type UserStatus = "invited" | "active" | "churned";

export type AuthUser = {
  id: string;
  orgId: string | null;
  role: UserRole;
  status: UserStatus;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  image: string | null;
  languagePref: string;
  region: string | null;
  source: "hrms" | "csv" | "manual";
  isSales: boolean;
  activatedAt: string | null;
  createdAt: string;
};

export type AuthErrorPayload = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  requiresVerification?: boolean;
  email?: string;
};

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<AuthUser | null>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
