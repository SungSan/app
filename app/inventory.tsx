// app/inventory.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Pressable,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useAccessToken } from "../lib/session"; // ✅ 변경: useAuthState -> useAccessToken

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

type CategoryFilter = "all" | "md" | "album";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}
function isHtmlLike(text: string) {
  const t = (text || "").trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<");
}

export default function Inventory() {
  // ✅ 변경: 토큰 소스만 교체 (로딩/로그아웃/정상 구분)
  const token = useAccessToken(); // undefined(로딩중) | null(로그아웃) | string(정상)

  const params = useLocalSearchParams<{ q?: string }>();

  const [q, setQ] = useState("");
  const [optionQ, setOptionQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<InventoryRow[]>([]);

  const lastAutoQRef = useRef<string>("__init__");
  const canUse = useMemo(() => Boolean(BASE && token), [token]);

  const search = useCallback(
    async (query?: string) => {
      if (!BASE) {
        Alert.alert("설정 오류", "EXPO_PUBLIC_API_BASE 확인(.env / EAS env)");
        return;
      }

      // ✅ 로딩중이면 “토큰 없음”으로 오판하지 않음
      if (token === undefined) {
        Alert.alert("확인 중", "로그인 상태를 확인 중입니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      if (!token) {
        Alert.alert("로그인 필요", "토큰이 없습니다. 다시 로그인하세요.");
        router.replace("/login");
        return;
      }

      const keyword = (query ?? q).trim();
      const url = new URL(`${BASE}/api/mobile/inventory`);
      if (keyword) url.searchParams.set("q", keyword);

      // 서버가 필터를 지원하면 사용, 아니면 무시되어도 무방
      if (categoryFilter !== "all") url.searchParams.set("category", categoryFilter);
      if (optionQ.trim()) url.searchParams.set("option", optionQ.trim());

      setLoading(true);
      try {
        const res = await fetch(url.toString(), {
          method: "GET",
          headers: authHeaders(token),
        });
        const text = await res.text().catch(() => "");

        if (isHtmlLike(text)) {
          Alert.alert("조회 실패", "HTML 응답(인증/라우팅/BASE 문제)입니다.");
          return;
        }
        if (!res.ok) {
          Alert.alert("조회 실패", `${res.status}\n\n${text.slice(0, 300)}`);
          return;
        }

        const data = JSON.parse(text) as InventoryRow[];
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        Alert.alert("조회 실패", e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    },
    [q, token, categoryFilter, optionQ]
  );

  // ✅ 변경: 로그아웃(null)일 때만 로그인으로
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token]);

  // ✅ 메인에서 스캔 -> params.q로 돌아오면 자동조회
  useEffect(() => {
    if (token === undefined || token === null) return;

    const incomingQ = String(params.q ?? "").trim();

    if (incomingQ) {
      if (lastAutoQRef.current !== incomingQ) {
        lastAutoQRef.current = incomingQ;
        setQ(incomingQ);
        search(incomingQ);
      }
      return;
    }

    if (lastAutoQRef.current === "__init__") {
      lastAutoQRef.current = "";
      search("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, params.q]);

  // 화면 필터(서버가 아직 필터 미지원이어도 UI는 유지)
  const filteredRows = useMemo(() => {
    const opt = optionQ.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryFilter !== "all") {
        if (String(r.category ?? "").toLowerCase() !== categoryFilter) return false;
      }
      if (opt) {
        const ropt = String(r.option ?? "").toLowerCase();
        if (!ropt.includes(opt)) return false;
      }
      return true;
    });
  }, [rows, categoryFilter, optionQ]);

  const openDetail = (item: InventoryRow) => {
    router.push({
      pathname: "/inventory-detail",
      params: {
        item_id: item.item_id,
        artist: item.artist,
        category: item.category,
        album_version: item.album_version,
        option: item.option ?? "",
        location: item.location,
        quantity: String(item.quantity),
        barcode: item.barcode ?? "",
      },
    });
  };

  // ✅ 초기화 버튼 (검색/필터를 초기 상태로 복귀)
  const onReset = () => {
    setQ("");
    setOptionQ("");
    setCategoryFilter("all");
    lastAutoQRef.current = "";
    setRows([]);
    router.replace({ pathname: "/inventory" });
    // token이 string일 때만 검색 실행
    if (typeof token === "string") search("");
  };

  const renderRow = ({ item }: { item: InventoryRow }) => (
    <Pressable
      onPress={() => openDetail(item)}
      style={{
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontWeight: "700", fontSize: 15, color: "#000" }}>
        {item.artist} / {item.album_version}
      </Text>
      <Text style={{ marginTop: 4, color: "#000" }}>
        {item.category}
        {item.option ? ` / ${item.option}` : ""}
      </Text>
      <Text style={{ marginTop: 4, color: "#000" }}>
        {item.location} / 수량 {item.quantity}
      </Text>
      {!!item.barcode && <Text style={{ marginTop: 4, color: "#000" }}>barcode: {item.barcode}</Text>}
      <Text style={{ marginTop: 6, color: "#000" }}>눌러서 상세/입출고/이관</Text>
    </Pressable>
  );

  // ✅ 로딩중(토큰 확인중)
  if (token === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10, color: "#000" }}>로딩중...</Text>
      </SafeAreaView>
    );
  }

  // ✅ 로그아웃 상태는 위 effect에서 /login으로 보내므로 화면은 렌더하지 않음
  if (token === null) return null;

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={["top"]} style={{ flex: 1, padding: 12, backgroundColor: "#fff" }}>
        {/* ✅ 메인에 고정: 빠른입고/일반입고 */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="빠른입고"
              onPress={() => router.push({ pathname: "/item", params: { mode: "quick-in" } })}
              disabled={!canUse}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="일반입고"
              onPress={() => router.push({ pathname: "/item", params: { mode: "movement", direction: "IN" } })}
              disabled={!canUse}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="전체" onPress={() => setCategoryFilter("all")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="MD" onPress={() => setCategoryFilter("md")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="ALBUM" onPress={() => setCategoryFilter("album")} />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="바코드 / 아티스트 / 앨범명 검색"
              placeholderTextColor="#666"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                padding: 10,
                borderRadius: 10,
                color: "#000",
                borderColor: "#ccc",
                backgroundColor: "#fff",
              }}
            />
          </View>
          <Button title="스캔" onPress={() => router.push({ pathname: "/scan", params: { target: "q" } })} />
          <Button title="초기화" onPress={onReset} />
        </View>

        <View style={{ marginBottom: 8 }}>
          <TextInput
            value={optionQ}
            onChangeText={setOptionQ}
            placeholder="옵션 검색 (예: A-1)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              padding: 10,
              borderRadius: 10,
              color: "#000",
              borderColor: "#ccc",
              backgroundColor: "#fff",
            }}
          />
        </View>

        {/* ✅ 조회 버튼: 파란색 통일 (RN Button 회색 문제 제거) */}
        <Pressable
          onPress={() => search(q)}
          disabled={!canUse || loading}
          style={({ pressed }) => [
            {
              height: 44,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: !canUse || loading ? "#cfd8dc" : "#1a73e8",
              opacity: pressed ? 0.85 : 1,
              marginBottom: 0,
            },
          ]}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>{loading ? "조회중..." : "조회"}</Text>
        </Pressable>

        <View style={{ flex: 1, marginTop: 12 }}>
          {loading ? (
            <View style={{ paddingTop: 20, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 8, color: "#000" }}>불러오는 중…</Text>
            </View>
          ) : (
            <FlatList
              data={filteredRows}
              keyExtractor={(item, idx) => `${item.item_id}-${item.location}-${idx}`}
              renderItem={renderRow}
              ListEmptyComponent={<Text style={{ color: "#000" }}>조회 결과가 없습니다.</Text>}
            />
          )}
        </View>
      </SafeAreaView>
    </>
  );
}
