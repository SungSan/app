// app/login.tsx
import React, { useEffect, useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase, ensureSupabaseConfigOrAlert } from "../lib/supabase"; // 🔹 [추가]
import { useAuthState } from "../lib/session";

export default function Login() {
  const auth = useAuthState();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.status === "signed_in") router.replace("/inventory");
  }, [auth.status]);

  async function onLogin() {
    // 🔹 [추가] 로그인 전에 Supabase 설정 체크 (env 비면 여기서 즉시 중단)
    if (!ensureSupabaseConfigOrAlert()) return;

    const e = email.trim();
    const p = pw;
    if (!e || !p) {
      Alert.alert("입력 필요", "이메일/비밀번호를 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: e,
        password: p,
      });
      if (error) {
        Alert.alert("로그인 실패", error.message);
        return;
      }
      router.replace("/inventory");
    } catch (err: any) {
      Alert.alert("로그인 실패", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#fff", padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: "#000", marginBottom: 12 }}>
        로그인
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="@sound-wave.co.kr"
        placeholderTextColor="#666"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 10,
          padding: 12,
          color: "#000",
          marginBottom: 10,
        }}
      />
      <TextInput
        value={pw}
        onChangeText={setPw}
        placeholder="password"
        placeholderTextColor="#666"
        secureTextEntry
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 10,
          padding: 12,
          color: "#000",
          marginBottom: 14,
        }}
      />

      <Button
        title={loading ? "로그인 중..." : "로그인"}
        onPress={onLogin}
        disabled={loading}
      />
      <View style={{ height: 10 }} />
      <Button title="뒤로" onPress={() => router.replace("/")} />
    </SafeAreaView>
  );
}
