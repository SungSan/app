import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";
import { Alert } from "react-native";

type Extra = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  API_BASE?: string;

  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_API_BASE?: string;
};

function getExtra(): Extra {
  const expoConfigExtra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const manifestExtra = ((Constants as any).manifest?.extra ?? {}) as Extra;
  const manifest2Extra = ((Constants as any).manifest2?.extra ?? {}) as Extra;
  return { ...manifestExtra, ...manifest2Extra, ...expoConfigExtra };
}

function pickEnv(name: keyof Extra, fallbackProcessEnvKey?: string): string {
  const extra = getExtra();
  const v = extra[name];
  if (typeof v === "string" && v.trim()) return v.trim();

  if (fallbackProcessEnvKey) {
    const pv = (process.env as any)?.[fallbackProcessEnvKey];
    if (typeof pv === "string" && pv.trim()) return pv.trim();
  }
  return "";
}

const supabaseUrl =
  pickEnv("SUPABASE_URL") ||
  pickEnv("EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL");

const supabaseAnonKey =
  pickEnv("SUPABASE_ANON_KEY") ||
  pickEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY");

/**
 * ⚠️ 중요:
 * - 여기서 throw 하면 APK가 "켜자마자 종료"로 회귀합니다.
 * - 대신, 잘못된 설정이면 로그인 시점에서 안내(Alert)하고,
 *   Supabase 호출은 실패하도록 두는 방식이 안전합니다.
 */
export function ensureSupabaseConfigOrAlert(): boolean {
  const ok = Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
  if (!ok) {
    Alert.alert(
      "설정 오류",
      `Supabase 설정이 없습니다.\nurl=${Boolean(supabaseUrl)} key=${Boolean(supabaseAnonKey)}\n\n(eas.json의 env에 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 확인)`
    );
  }
  return ok;
}

export const supabase = createClient(supabaseUrl || "https://invalid.local", supabaseAnonKey || "invalid");

