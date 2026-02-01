// app/transfer.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthState } from "../lib/session";

const BASE = (process.env.EXPO_PUBLIC_API_BASE || "").replace(/\/+$/, "");

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
}
function isHtmlLike(text: string) {
  const t = (text || "").trim();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<");
}
function uuidv4(): string {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export default function Transfer() {
  const auth = useAuthState();
  const token = auth.status === "signed_in" ? auth.accessToken : null;

  const p = useLocalSearchParams<{
    item_id?: string;
    artist?: string;
    category?: string;
    album_version?: string;
    option?: string;
    from_location?: string;
    barcode?: string;

    scanTarget?: string;
    scanned?: string;
  }>();

  const [fromLocation, setFromLocation] = useState(String(p.from_location ?? ""));
  const [toLocation, setToLocation] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const info = useMemo(() => {
    return {
      item_id: String(p.item_id ?? ""),
      artist: String(p.artist ?? ""),
      category: String(p.category ?? ""),
      album_version: String(p.album_version ?? ""),
      option: String(p.option ?? ""),
      barcode: String(p.barcode ?? ""),
    };
  }, [p]);

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/login");
  }, [auth.status]);

  // 로케이션 스캔 결과 반영(to_location용)
  useEffect(() => {
    const scanTarget = String(p.scanTarget ?? "");
    const scanned = String(p.scanned ?? "").trim();
    if (scanTarget === "to_location" && scanned) setToLocation(scanned);
  }, [p.scanTarget, p.scanned]);

  const goScanToLocation = () => {
    router.push({ pathname: "/scan", params: { returnTo: "transfer", target: "to_location" } });
  };

  const submit = async () => {
    if (!token) return;
    if (!BASE) {
      Alert.alert("설정 오류", "EXPO_PUBLIC_API_BASE가 비어있습니다.");
      return;
    }

    const n = Number(quantity);
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert("입력 오류", "수량은 1 이상의 숫자여야 합니다.");
      return;
    }
    if (!fromLocation.trim() || !toLocation.trim()) {
      Alert.alert("입력 오류", "보내는곳/받는곳 로케이션을 입력하세요.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/mobile/transfer`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          artist: info.artist,
          category: info.category,
          album_version: info.album_version,
          option: info.option || null,
          from_location: fromLocation.trim(),
          to_location: toLocation.trim(),
          quantity: n,
          barcode: info.barcode || null,
          memo: memo || null,
          idempotencyKey: uuidv4(),
        }),
      });

      const text = await res.text().catch(() => "");
      if (isHtmlLike(text)) {
        Alert.alert("이관 실패", "HTML 응답(인증/라우팅/BASE 문제)입니다.");
        return;
      }
      if (!res.ok) {
        Alert.alert("이관 실패", `${res.status}\n\n${text.slice(0, 300)}`);
        return;
      }

      router.replace("/inventory");
    } catch (e: any) {
      Alert.alert("이관 실패", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (auth.status === "loading") {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>로딩중…</Text>
      </SafeAreaView>
    );
  }
  if (!token) return null;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>전산 이관</Text>

        <View style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, gap: 6 }}>
          <Text style={{ fontWeight: "700" }}>
            {info.artist} / {info.album_version}
          </Text>
          <Text>
            {info.category}
            {info.option ? ` / ${info.option}` : ""}
          </Text>
          {!!info.barcode && <Text style={{ color: "#666" }}>barcode: {info.barcode}</Text>}
        </View>

        <Text>보내는곳(from)</Text>
        <TextInput value={fromLocation} onChangeText={setFromLocation} style={inputStyle} autoCapitalize="none" />

        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text>받는곳(to)</Text>
            <TextInput value={toLocation} onChangeText={setToLocation} style={inputStyle} autoCapitalize="none" />
          </View>
          <View style={{ width: 120, marginTop: 18 }}>
            <Button title="로케이션 스캔" onPress={goScanToLocation} />
          </View>
        </View>

        <Text>수량</Text>
        <TextInput value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={inputStyle} />

        <Text>메모</Text>
        <TextInput value={memo} onChangeText={setMemo} style={inputStyle} />

        <Button title={saving ? "처리중..." : "이관 등록"} onPress={submit} disabled={saving} />
        <Button title="재고조회로" onPress={() => router.replace("/inventory")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: "#ccc",
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 8,
} as const;
