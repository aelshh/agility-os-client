import { motion } from "framer-motion";

import { pageVariants } from "../lib/animation";

export function LoadingPage() {
  return (
    <motion.div
      key="loading"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen font-sans flex items-center justify-center bg-neutral-50"
    >
      <motion.span
        className="text-sm font-semibold uppercase tracking-widest text-neutral-700"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        Loading…
      </motion.span>
    </motion.div>
  );
}
