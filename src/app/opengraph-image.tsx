import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "FunkSquish — Get Your Squish On! Squishies coming soon.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Fredoka (SIL Open Font License) to match the site's headline font.
const fredokaBold = await readFile(join(process.cwd(), "src/assets/fonts/Fredoka-Bold.ttf"));
// Official round badge logo (transparent corners), 560px.
const logo = await readFile(join(process.cwd(), "src/assets/brand-logo-560.png"));
const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 70px 0 90px",
          gap: 40,
          background: "radial-gradient(circle at 80% 30%, #ffffff 0%, #e4f3ff 35%, #b4deff 100%)",
          color: "#0e2a5c",
          fontFamily: "Fredoka",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: "#ffffff",
              color: "#1f5fd6",
              borderRadius: 999,
              padding: "10px 26px",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 4,
            }}
          >
            COMING SOON
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, marginTop: 30 }}>FunkSquish</div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: "#1f5fd6", lineHeight: 1 }}>
            Get Your Squish On!
          </div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 28, color: "#3a5486" }}>
            Colorful, cute & seriously satisfying squishies · @FunkSquish
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={430} height={430} alt="" />
      </div>
    ),
    { ...size, fonts: [{ name: "Fredoka", data: fredokaBold, weight: 700, style: "normal" }] },
  );
}
