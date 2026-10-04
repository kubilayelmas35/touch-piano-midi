import { isNativeApp } from "../lib/platform";

export type ShareResult = "shared" | "saved" | "cancelled";

function toBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function download(data: ArrayBuffer, fileName: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: "audio/midi" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const coarse = () => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

/**
 * Sends a MIDI file out of the app: the Android/iOS share sheet in the apps, the system share sheet on
 * phones' browsers, otherwise a normal download (the desktop app asks where to save it).
 */
export async function shareMidi(data: ArrayBuffer, fileName: string, title: string): Promise<ShareResult> {
  if (isNativeApp) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const { uri } = await Filesystem.writeFile({ path: fileName, data: toBase64(data), directory: Directory.Cache });
    try {
      await Share.share({ title, files: [uri], dialogTitle: title });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const file = new File([data], fileName, { type: "audio/midi" });
  if (coarse() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  download(data, fileName);
  return "saved";
}
