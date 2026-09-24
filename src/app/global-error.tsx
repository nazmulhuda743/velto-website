"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#ffffff", color: "#002B4E" }}>
        <main style={{ maxWidth: 760, margin: "0 auto", padding: "96px 24px" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#B42318" }}>
            Velto website error
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: "clamp(36px, 6vw, 56px)", lineHeight: 1.05 }}>
            The website couldn’t load properly.
          </h1>
          <p style={{ marginTop: 20, maxWidth: 620, fontSize: 18, lineHeight: 1.6, color: "#30373D" }}>
            No booking or quote should be assumed successful unless you receive a real confirmation from Velto.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 28, minHeight: 48, border: 0, borderRadius: 8, padding: "0 24px", background: "#027CC3", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
