// app/item.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthState } from "../lib/session";

const BASE = (process.env.EXPO_PUBLIC_API_BASE || "").replace(/\/+$/, "");

type InventoryRow = {
  item_id: string;
  artist: string;
  category: string;
  album_version: string;
  option?: string | null;
  location: string;
  quantity: number;
  barcode?: string | null;
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function isHtmlLike(text: string) {
  const t = (text || "").trim();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<");
}

function uuidv4(): string {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export default function Item() {
  const auth = useAuthState();
  const token = auth.status === "signed_in" ? auth.accessToken : null;

  const p = useLocalSearchParams<{
    mode?: string;
    direction?: string;

    // 상세에서 넘어올 때 프리필
    item_id?: string;
    artist?: string;
    category?: string;
    album_version?: string;
    option?: string;
    location?: string;
    barcode?: string;

    // 스캔에서 돌아올 때
    scanTarget?: string; // "barcode" | "location"
    scanned?: string;
  }>();

  const mode = (String(p.mode ?? "movement") as "quick-in" | "movement") ?? "movement";
  const direction = (String(p.direction ?? "IN") as "IN" | "OUT") ?? "IN";

  const [artist, setArtist] = useState(String(p.artist ?? ""));
  const [category, setCategory] = useState(String(p.category ?? ""));
  const [albumVersion, setAlbumVersion] = useState(String(p.album_version ?? ""));
  const [option, setOption] = useState(String(p.option ?? ""));
  const [location, setLocation] = useState(String(p.location ?? ""));
  const [barcode, setBarcode] = useState(String(p.barcode ?? ""));
  const [quantity, setQuantity] = useState("1");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const canUse = useMemo(() => Boolean(BASE && token), [token]);

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/login");
  }, [auth.status]);

  const title = useMemo(() => {
    if (mode === "quick-in") return "빠른입고";
    return direction === "IN" ? "일반입고" : "출고";
  }, [mode, direction]);

  const hydrateFromBarcode = useCallback(
    async (bc: string) => {
      if (!token) return;
      if (!BASE) {
        Alert.alert("설정 오류", "EXPO_PUBLIC_API_BASE가 비어있습니다.");
        return;
      }
      const v = bc.trim();
      if (!v) return;

      setBarcode(v);

      try {
        const url = new URL(`${BASE}/api/mobile/inventory`);
        url.searchParams.set("q", v);

        const res = await fetch(url.toString(), { method: "GET", headers: authHeaders(token) });
        const text = await res.text().catch(() => "");

        if (isHtmlLike(text)) {
          Alert.alert("스캔 조회 실패", "HTML 응답(인증/라우팅/BASE 문제)입니다.");
          return;
        }
        if (!res.ok) return;

        const data = JSON.parse(text) as InventoryRow[];
        if (!Array.isArray(data) || data.length === 0) return;

        const r = data[0];
        setArtist(r.artist ?? "");
        setCategory(r.category ?? "");
        setAlbumVersion(r.album_version ?? "");
        setOption((r.option ?? "") as string);
        // 로케이션도 자동 입력(원치 않으면 이 줄만 제거)
        setLocation(r.location ?? "");
      } catch {
        // 조용히 무시
      }
    },
    [token]
  );

  // ✅ scan 화면에서 돌아온 값 적용
  useEffect(() => {
    const scanTarget = String(p.scanTarget ?? "");
    const scanned = String(p.scanned ?? "").trim();
    if (!scanTarget || !scanned) return;

    if (scanTarget === "location") {
      setLocation(scanned);
      return;
    }
    if (scanTarget === "barcode") {
      hydrateFromBarcode(scanned);
      return;
    }
  }, [p.scanTarget, p.scanned, hydrateFromBarcode]);

  const goScanBarcode = () => {
    router.push({
      pathname: "/scan",
      params: { returnTo: "item", target: "barcode", mode, direction },
    });
  };

  const goScanLocation = () => {
    router.push({
      pathname: "/scan",
      params: { returnTo: "item", target: "location", mode, direction },
    });
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

    const idempotencyKey = uuidv4();

    setSaving(true);
    try {
      const effectiveDirection = mode === "quick-in" ? "IN" : direction;

      const res = await fetch(`${BASE}/api/mobile/movements`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          artist,
          category,
          album_version: albumVersion,
          option: option || null,
          location,
          quantity: n,
          direction: effectiveDirection,
          memo: memo || null,
          barcode: barcode || null,
          idempotencyKey,
        }),
      });

      const text = await res.text().catch(() => "");
      if (isHtmlLike(text)) {
        Alert.alert("등록 실패", "HTML 응답(인증/라우팅/BASE 문제)입니다.");
        return;
      }
      if (!res.ok) {
        Alert.alert("등록 실패", `${res.status}\n\n${text.slice(0, 300)}`);
        return;
      }

      // 성공 후 메인으로 이동(중복등록 방지)
      router.replace("/inventory");
    } catch (e: any) {
      Alert.alert("등록 실패", e?.message ?? String(e));
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
        <Text style={{ fontSize: 18, fontWeight: "700" }}>{title}</Text>

        {/* ✅ 스캔 버튼 2개 */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="바코드 스캔" onPress={goScanBarcode} disabled={!canUse} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="로케이션 스캔" onPress={goScanLocation} disabled={!canUse} />
          </View>
        </View>

        <Button title="재고조회로" onPress={() => router.replace("/inventory")} />

        <View style={{ gap: 6 }}>
          <Text>아티스트</Text>
          <TextInput value={artist} onChangeText={setArtist} style={inputStyle} />
          <Text>카테고리</Text>
          <TextInput value={category} onChangeText={setCategory} style={inputStyle} />
          <Text>앨범/버전</Text>
          <TextInput value={albumVersion} onChangeText={setAlbumVersion} style={inputStyle} />
          <Text>옵션</Text>
          <TextInput value={option} onChangeText={setOption} style={inputStyle} />
          <Text>로케이션</Text>
          <TextInput value={location} onChangeText={setLocation} style={inputStyle} autoCapitalize="none" />
          <Text>바코드</Text>
          <TextInput value={barcode} onChangeText={setBarcode} style={inputStyle} autoCapitalize="none" />
          <Text>수량</Text>
          <TextInput value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={inputStyle} />
          <Text>메모</Text>
          <TextInput value={memo} onChangeText={setMemo} style={inputStyle} />
        </View>

        <Button title={saving ? "처리중..." : "등록"} onPress={submit} disabled={!canUse || saving} />
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

