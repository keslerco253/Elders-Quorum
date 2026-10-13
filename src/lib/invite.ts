import QRCode from "qrcode";
import { appUrl } from "./config";

export const joinLink = (code: string) => `${appUrl()}/join?code=${encodeURIComponent(code)}`;

/** An SVG QR code that opens the join page with the code already filled in. */
export async function joinQrSvg(code: string) {
  return QRCode.toString(joinLink(code), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1d3a5f", light: "#ffffff" } });
}
