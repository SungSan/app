import Constants from "expo-constants";

type Extra = {
  API_BASE?: string;
  EXPO_PUBLIC_API_BASE?: string;
};

function getExtra(): Extra {
  const expoConfigExtra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const manifest2Extra = ((Constants as any).manifest2?.extra ?? {}) as Extra;
  return { ...manifest2Extra, ...expoConfigExtra };
}

function getApiBase(): string {
  const extra = getExtra();

  const fromExtra =
    (typeof extra.API_BASE === "string" ? extra.API_BASE.trim() : "") ||
    (typeof extra.EXPO_PUBLIC_API_BASE === "string" ? extra.EXPO_PUBLIC_API_BASE.trim() : "");

  const fromProcess = (process.env as any)?.EXPO_PUBLIC_API_BASE;
  const base = (fromExtra || (typeof fromProcess === "string" ? fromProcess.trim() : "") || "").trim();

  return base;
}

function normalizeBaseUrl(base: string): string {
  const b = base.trim().replace(/\/+$/, ""); // trailing slash 제거
  if (!b) throw new Error("EXPO_PUBLIC_API_BASE가 비어있습니다. (eas.json env 확인)");
  if (!/^https:\/\//i.test(b)) {
    // Android에서 http는 기본적으로 막혀서 Network request failed가 나기 쉬움
    throw new Error(`API_BASE는 https:// 여야 합니다. 현재: ${b}`);
  }
  return b;
}

export async function apiGet(path: string, token?: string | null): Promise<string> {
  const base = normalizeBaseUrl(getApiBase());
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}\nURL: ${url}\n\n${text.slice(0, 300)}`);
    }
    return text;
  } catch (e: any) {
    // fetch 자체가 실패할 때(=Network request failed)도 URL을 같이 뱉게
    const msg = e?.message ?? String(e);
    throw new Error(`Network request failed\nURL: ${url}\n\n${msg}`);
  }
}

