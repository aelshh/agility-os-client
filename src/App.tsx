function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center gap-4">
        <span className="h-3 w-3 rounded-full bg-brand-500" />
        <span className="text-brand-500 font-semibold tracking-widest uppercase text-sm">
          Client ready
        </span>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-center">
        React + Vite + TypeScript + Tailwind v4
      </h1>
      <p className="text-slate-400 text-center max-w-md">
        Edit <code className="text-brand-500">src/App.tsx</code> and save to test
        HMR. Tailwind utility classes are compiled on the fly.
      </p>
      <a
        href="https://vite.dev"
        target="_blank"
        rel="noreferrer"
        className="rounded-lg bg-brand-600 hover:bg-brand-500 transition-colors px-4 py-2 font-medium"
      >
        Vite docs
      </a>
    </div>
  )
}

export default App
