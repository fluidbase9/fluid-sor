import FluidSwap from "./FluidSwap";
import { FLUID_SITE, FLUID_GITHUB, FLUID_NPM } from "./config";

export default function App() {
  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "0.5rem", marginBottom: "2rem" }}>
        {/* Logo + title */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
          <img
            src="https://fluidspot.s3.us-east-2.amazonaws.com/web/Base/media_files/fluid23.png"
            alt="Fluid"
            style={{ width: 48, height: 48, borderRadius: 10, objectFit: "contain", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: "2.25rem", lineHeight: 1.1, color: "#fff", margin: 0 }}>
            Smart Order Routing
          </h1>
        </div>
        {/* Subheading */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", fontFamily: "'Inter', sans-serif", fontWeight: 600, fontStyle: "italic", fontSize: "0.9rem", color: "#cbd5e1", letterSpacing: "0.04em" }}>
          <span>Powered by</span>
          <img
            src="https://fluidspot.s3.us-east-2.amazonaws.com/12th_march-2026/fluid_intelliegence.png"
            alt="Fluid Intelligence"
            style={{ width: 18, height: 18, borderRadius: 4, objectFit: "cover" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span>Fluid Intelligence</span>
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontStyle: "italic", fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
          Best prices · Minimal slippage · 25+ DEX venues across 4 networks
        </p>
      </div>

      {/* Swap widget */}
      <FluidSwap />

      {/* Footer links */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "1.5rem",
        marginTop: "2rem",
        fontSize: "0.75rem",
        color: "#4b5563",
      }}>
        <a href={FLUID_SITE}   target="_blank" rel="noreferrer" style={linkStyle}>fluidnative.com</a>
        <a href={FLUID_GITHUB} target="_blank" rel="noreferrer" style={linkStyle}>GitHub</a>
        <a href={FLUID_NPM}    target="_blank" rel="noreferrer" style={linkStyle}>npm</a>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  color: "#6b7280",
  textDecoration: "none",
};
