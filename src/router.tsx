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
// /courses — Course creation & review (content_curator + architect)
// ---------------------------------------------------------------------------

const canManageCourses = (role: string | undefined) =>
  role === "content_curator" || role === "architect";

const courseRoleGuard = () => async ({ context }: { context: { user: { role: string } } }) => {
  if (!canManageCourses(context.user.role)) {
    throw redirect({ to: "/" });
  }
};

const coursesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/courses",
  beforeLoad: courseRoleGuard(),
  component: lazyRouteComponent(() => import("./pages/CoursesPage"), "CoursesPage"),
});

const newCourseRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/courses/new",
  beforeLoad: courseRoleGuard(),
  component: lazyRouteComponent(
    () => import("./pages/CourseEditorPage"),
    "CourseEditorPage",
  ),
});

const editCourseRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/courses/$courseId/edit",
  beforeLoad: courseRoleGuard(),
  component: lazyRouteComponent(
    () => import("./pages/CourseEditorPage"),
    "CourseEditorPage",
  ),
});

const approvalsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/courses/approvals",
  beforeLoad: async ({ context }) => {
    if (context.user.role !== "architect") {
      throw redirect({ to: "/" });
    }
  },
  component: lazyRouteComponent(
    () => import("./pages/CourseApprovalsPage"),
    "CourseApprovalsPage",
  ),
});

const reviewCourseRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/courses/approvals/$courseId",
  beforeLoad: async ({ context }) => {
    if (context.user.role !== "architect") {
      throw redirect({ to: "/" });
    }
  },
  component: lazyRouteComponent(
    () => import("./pages/CourseReviewPage"),
    "CourseReviewPage",
  ),
});

// ---------------------------------------------------------------------------
// /checkins — Daily check-ins (non-practitioners only)
// ---------------------------------------------------------------------------

const checkinRoleGuard = () => ({ context }: { context: { user: { role: string } } }) => {
  if (context.user.role === "practitioner") {
    throw redirect({ to: "/" });
  }
};

const checkinsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/checkins",
  beforeLoad: checkinRoleGuard(),
  component: lazyRouteComponent(
    () => import("./pages/DailyCheckinsPage"),
    "DailyCheckinsPage",
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
  protectedRoute.addChildren([
    indexRoute,
    profileRoute,
    coursesRoute,
    newCourseRoute,
    editCourseRoute,
    approvalsRoute,
    reviewCourseRoute,
    checkinsRoute,
  ]),
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
