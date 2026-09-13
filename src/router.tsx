import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { apiGetMe } from "./api/auth";
import { AuthProvider } from "./features/auth";
import { DashboardPage } from "./pages/DashboardPage";
import { InviteAcceptPage } from "./pages/InviteAcceptPage";
import { LoginPage } from "./pages/LoginPage";
import { OrgBootstrapPage } from "./pages/OrgBootstrapPage";

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

// ---------------------------------------------------------------------------
// Auth guard loader — fetches the current user before rendering protected routes.
// Returns null if not authenticated (does not redirect here — child routes decide).
// ---------------------------------------------------------------------------

async function loadMe() {
  try {
    return await apiGetMe();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// / — Dashboard (protected)
// ---------------------------------------------------------------------------

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const user = await loadMe();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: DashboardPage,
});

// ---------------------------------------------------------------------------
// /login
// ---------------------------------------------------------------------------

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: async () => {
    // If already authenticated, bounce to dashboard
    const user = await loadMe();
    if (user) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

// ---------------------------------------------------------------------------
// /signup — Org Bootstrap
// ---------------------------------------------------------------------------

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  beforeLoad: async () => {
    // If already has an account, bounce to dashboard
    const user = await loadMe();
    if (user) {
      throw redirect({ to: "/" });
    }
  },
  component: OrgBootstrapPage,
});

// ---------------------------------------------------------------------------
// /accept/$token — Invite Acceptance
// ---------------------------------------------------------------------------

const acceptRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accept/$token",
  component: InviteAcceptPage,
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  acceptRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
