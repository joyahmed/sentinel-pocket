"use client";

// /smoke - developer page: one alert through each Firebase AI Logic route.
import useSmoke from "@/hooks/use-smoke";

const SmokePage = () => {
  const { sample, results, run } = useSmoke();

  return (
    <main className="mx-auto max-w-3xl p-4 font-mono text-sm sm:p-6">
      <h1 className="mb-2 text-xl font-bold">Sentinel Pocket - smoke test</h1>
      <p className="mb-4 break-words">{sample.summary}</p>
      <button id="run" className="mb-4 border px-3 py-1" onClick={run}>
        run
      </button>
      <ul className="space-y-3">
        {results.map((r) => (
          <li key={r.route} className="break-words">
            <b>{r.route}</b> - {r.ms} ms - ran: {r.source ?? "?"}
            <pre className="whitespace-pre-wrap">{r.text}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
};

export default SmokePage;
