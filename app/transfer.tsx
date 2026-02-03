// app/transfer.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthState } from "../lib/session";
import { resolveApiBase } from "../lib/api";

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
  const apiBase = useMemo(() => resolveApiBase(), []);

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
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [selectRows, setSelectRows] = useState<
    Array<{
      item_id: string;
      artist: string;
      category: string;
      album_version: string;
      option?: string;
      barcode?: string;
      location?: string;
    }>
  >([]);
  const [selectVisible, setSelectVisible] = useState(false);

  const [info, setInfo] = useState(() => {
    return {
      item_id: String(p.item_id ?? ""),
      artist: String(p.artist ?? ""),
      category: String(p.category ?? ""),
      album_version: String(p.album_version ?? ""),
      option: String(p.option ?? ""),
      barcode: String(p.barcode ?? ""),
    };
  });

  useEffect(() => {
    setInfo({
      item_id: String(p.item_id ?? ""),
      artist: String(p.artist ?? ""),
      category: String(p.category ?? ""),
      album_version: String(p.album_version ?? ""),
      option: String(p.option ?? ""),
      barcode: String(p.barcode ?? ""),
    });
    setFromLocation(String(p.from_location ?? ""));
  }, [p.item_id, p.artist, p.category, p.album_version, p.option, p.barcode, p.from_location]);

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/login");
  }, [auth.status]);

  useEffect(() => {
    const needsInfo = !info.artist && !info.album_version && !info.category;
    if (!needsInfo) return;
    if (!token || !apiBase.base) return;

    const keyword = info.barcode || info.item_id;
    if (!keyword) return;

    setLoadingInfo(true);
    const url = new URL(`${apiBase.base}/api/mobile/inventory`);
    url.searchParams.set("q", keyword);

    fetch(url.toString(), { method: "GET", headers: authHeaders(token) })
      .then((res) => res.text().then((text) => ({ res, text })))
      .then(({ res, text }) => {
        if (!res.ok) return;
        const data = JSON.parse(text) as Array<{
          item_id: string;
          artist: string;
          category: string;
          album_version: string;
          option?: string | null;
          barcode?: string | null;
          location?: string | null;
        }>;
        if (!Array.isArray(data) || data.length === 0) return;
        if (data.length === 1) {
          const row = data[0];
          setInfo({
            item_id: row.item_id,
            artist: row.artist,
            category: row.category,
            album_version: row.album_version,
            option: row.option ?? "",
            barcode: row.barcode ?? "",
          });
          if (!fromLocation && row.location) setFromLocation(row.location);
          return;
        }
        setSelectRows(
          data.map((row) => ({
            item_id: row.item_id,
            artist: row.artist,
            category: row.category,
            album_version: row.album_version,
            option: row.option ?? "",
            barcode: row.barcode ?? "",
            location: row.location ?? "",
          }))
        );
        setSelectVisible(true);
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, [info.artist, info.album_version, info.category, info.barcode, info.item_id, token, apiBase.base, fromLocation]);

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
    if (!apiBase.base) {
      Alert.alert("설정 오류", apiBase.error ?? "EXPO_PUBLIC_API_BASE가 비어있습니다.");
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
      const res = await fetch(`${apiBase.base}/api/mobile/transfer`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          item_id: info.item_id || null,
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
            {info.artist || info.album_version ? `${info.artist} / ${info.album_version}` : "상품 정보 없음"}
          </Text>
          <Text>
            {info.category || info.option ? `${info.category}${info.option ? ` / ${info.option}` : ""}` : "카테고리 정보 없음"}
          </Text>
          {!!info.barcode && <Text style={{ color: "#666" }}>barcode: {info.barcode}</Text>}
          {loadingInfo && <Text style={{ color: "#666" }}>상품 정보를 불러오는 중…</Text>}
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

      <Modal visible={selectVisible} transparent animationType="fade" onRequestClose={() => setSelectVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, maxHeight: "80%" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 8 }}>상품 선택</Text>
            <ScrollView>
              {selectRows.map((row, idx) => (
                <Pressable
                  key={`${row.item_id}-${row.location}-${idx}`}
                  onPress={() => {
                    setInfo({
                      item_id: row.item_id,
                      artist: row.artist,
                      category: row.category,
                      album_version: row.album_version,
                      option: row.option ?? "",
                      barcode: row.barcode ?? "",
                    });
                    if (!fromLocation && row.location) setFromLocation(row.location);
                    setSelectVisible(false);
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: "#ddd",
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontWeight: "700" }}>
                    {row.artist} / {row.album_version}
                  </Text>
                  <Text style={{ color: "#333" }}>
                    {row.category}
                    {row.option ? ` / ${row.option}` : ""}
                  </Text>
                  <Text style={{ color: "#666" }}>{row.location}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button title="닫기" onPress={() => setSelectVisible(false)} />
          </View>
        </View>
      </Modal>
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
