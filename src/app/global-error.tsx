"use client";

/** When even the app's frame can't show: a plain page to try again from. */
export default function GlobalError() {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#f6f4ef",
          color: "#1f2937",
          margin: 0,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            margin: "0 auto",
            padding: "48px 16px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20 }}>That didn&apos;t go through</h1>
          <p style={{ fontSize: 14, color: "#6b7280" }}>
            Your last change may not have saved. The app may be updating, or the
            connection dropped. Wait a moment and try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 10,
              border: 0,
              background: "#1e3a5f",
              color: "#fff",
              fontSize: 15,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
