import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";

import { router } from "./router";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
            fontSize: "14px",
            fontWeight: 500,
            borderRadius: "12px",
            padding: "12px 16px",
          },
        }}
      />
    </>
  );
}
