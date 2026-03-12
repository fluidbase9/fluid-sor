import FluidSwap from "./FluidSwap";
import { FLUID_SITE, FLUID_GITHUB, FLUID_NPM } from "./config";

export default function App() {
  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>
          <span style={{ color: "#22d3ee" }}>Fluid</span> Swap
        </h1>
        <p style={{ color: "#6b7280", fontSize: "0.8rem" }}>
          Powered by FluidSOR · Best price across DEXs
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
