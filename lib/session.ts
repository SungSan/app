// lib/session.ts
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type AuthState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; accessToken: string };

export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    // 1) 초기 세션 로드
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      const session = data?.session ?? null;
      if (error || !session?.access_token) setState({ status: "signed_out" });
      else setState({ status: "signed_in", accessToken: session.access_token });
    });

    // 2) 세션 변경 구독
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session?.access_token) setState({ status: "signed_out" });
      else setState({ status: "signed_in", accessToken: session.access_token });
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return state;
}

// 편의용: 기존 코드에서 useAccessToken()을 쓰는 걸 유지
export function useAccessToken(): string | null | undefined {
  const auth = useAuthState();
  if (auth.status === "loading") return undefined;
  if (auth.status === "signed_out") return null;
  return auth.accessToken;
}

export async function signOut() {
  await supabase.auth.signOut();
}
