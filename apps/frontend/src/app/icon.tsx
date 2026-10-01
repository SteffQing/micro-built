import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#8A0806",
          borderRadius: 6,
        }}
      >
        <span style={{ color: "white", fontWeight: 700, fontSize: 20 }}>
          M
        </span>
      </div>
    ),
    size
  );
}