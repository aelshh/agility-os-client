import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { Suspense } from "react";

import { apiGetMe } from "./api/auth";
import { apiGetHrmsStatus } from "./api/hrms";
import { AppShell } from "./components/AppShell";
import { AuthProvider } from "./features/auth";
import { LoadingPage } from "./pages/LoadingPage";
import { apiGetProfile } from "./api/profile";
import type { AuthErrorPayload } from "./features/auth";
import { Button } from "./components";

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

function RootLayout() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingPage />}>
        <Outlet />
      </Suspense>
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
// Authenticated app shell — wraps all protected pages in the shared nav.
// ---------------------------------------------------------------------------

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: async () => {
    const user = await loadMe();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: AppShell,
});

// ---------------------------------------------------------------------------
// / — Dashboard (protected)
// ---------------------------------------------------------------------------

const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/",
  beforeLoad: async ({ context }) => {
    const user = context.user;
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
  },
  component: lazyRouteComponent(
    () => import("./pages/DashboardPage"),
    "DashboardPage",
  ),
});

// ---------------------------------------------------------------------------
// /profile — View & edit profile details (protected)
// ---------------------------------------------------------------------------

function ProfileLoadError({ error }: { error: unknown }) {
  const router = useRouter();
  const message =
    (error as AuthErrorPayload | null)?.message ??
    "Couldn't load your profile. Please try again.";
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
      <p className="text-sm font-medium text-neutral-600">{message}</p>
      <Button variant="outline" onClick={() => void router.invalidate()}>
        Try again
      </Button>
    </div>
  );
}

const profileRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/profile",
  loader: async () => apiGetProfile(),
  errorComponent: ProfileLoadError,
  component: lazyRouteComponent(
    () => import("./pages/ProfilePage"),
    "ProfilePage",
  ),
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
  component: lazyRouteComponent(
    () => import("./pages/ConnectHrmsPage"),
    "ConnectHrmsPage",
  ),
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
  component: lazyRouteComponent(() => import("./pages/LoginPage"), "LoginPage"),
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
  component: lazyRouteComponent(
    () => import("./pages/OrgBootstrapPage"),
    "OrgBootstrapPage",
  ),
});

// ---------------------------------------------------------------------------
// /accept/$token — Invite Acceptance
// ---------------------------------------------------------------------------

const acceptRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accept/$token",
  component: lazyRouteComponent(
    () => import("./pages/InviteAcceptPage"),
    "InviteAcceptPage",
  ),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  protectedRoute.addChildren([indexRoute, profileRoute]),
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
