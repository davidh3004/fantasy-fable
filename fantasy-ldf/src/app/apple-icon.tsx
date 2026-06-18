import { ImageResponse } from "next/og";

// iOS home-screen icon (PNG; Apple doesn't render SVG touch icons).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7c3aed",
          color: "#ffffff",
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        LDF
      </div>
    ),
    { ...size }
  );
}
