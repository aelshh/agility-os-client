import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { apiGetMe } from "./api/auth";
import { apiGetHrmsStatus } from "./api/hrms";
import { AuthProvider } from "./features/auth";
import { ConnectHrmsPage } from "./pages/ConnectHrmsPage";
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
    // HRMS connect is a mandatory post-signup step for architects.
    if (user.role === "architect") {
      let connected = true;
      try {
        const status = await apiGetHrmsStatus();
        connected = status.connected;
      } catch {
        // On error, assume connected so a transient failure doesn't lock the user out.
      }
      if (!connected) {
        throw redirect({ to: "/connect-hrms" });
      }
    }
    return { user };
  },
  component: DashboardPage,
});

// ---------------------------------------------------------------------------
// /connect-hrms — Mandatory post-signup HRMS connection
// ---------------------------------------------------------------------------

const connectHrmsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connect-hrms",
  beforeLoad: async () => {
    const user = await loadMe();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: ConnectHrmsPage,
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
  connectHrmsRoute,
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
