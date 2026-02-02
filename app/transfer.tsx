// app/transfer.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Pressable,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useAccessToken } from "../lib/session";
import { apiGet } from "../lib/api";
import { supabase } from "../lib/supabase";

const BASE = process.env.EXPO_PUBLIC_API_BASE;

type InvRow = { location: string };

export default function Transfer() {
  const token = useAccessToken();
  const params = useLocalSearchParams();

  const itemId = String(params.item_id ?? "");
  const fromDefault = String(params.from_location ?? "");

  const [fromLoc, setFromLoc] = useState(fromDefault);
  const [toLoc, setToLoc] = useState(String(params.to_location ?? ""));
  const [quantity, setQuantity] = useState(Number(params.quantity ?? 1));
  const [memo, setMemo] = useState(String(params.memo ?? ""));

  // item 메타 (전산이관 API가 요구하는 필드)
  const [meta, setMeta] = useState<{
    artist: string;
    category: string;
    album_version: string;
    option?: string | null;
  } | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const [invLoading, setInvLoading] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);

  const title = useMemo(() => "전산 이관", []);

  // ✅ item_id로 items 테이블에서 필수 메타를 로드 (missing fields 방지)
  useEffect(() => {
    let alive = true;

    async function loadMeta() {
      if (!itemId) {
        setMeta(null);
        return;
      }
      setMetaLoading(true);
      try {
        const { data, error } = await supabase
          .from("items")
          .select("artist, category, album_version, option")
          .eq("id", itemId)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.warn("[transfer] loadMeta error:", error);
          setMeta(null);
          return;
        }

        if (data) {
          setMeta({
            artist: String((data as any).artist ?? ""),
            category: String((data as any).category ?? ""),
            album_version: String((data as any).album_version ?? ""),
            option: ((data as any).option ?? null) as any,
          });
        } else {
          setMeta(null);
        }
      } finally {
        if (alive) setMetaLoading(false);
      }
    }

    loadMeta();
    return () => {
      alive = false;
    };
  }, [itemId]);

  // (기존 동작 유지) 재고 조회로 로케이션 후보 리스트 구성
  useEffect(() => {
    let alive = true;

    async function loadInventory() {
      setInvLoading(true);
      try {
        const data = await apiGet(`/api/mobile/inventory`, token ?? "");
        if (!alive) return;

        const inv: InvRow[] = Array.isArray(data?.rows) ? data.rows : [];
        const uniq = Array.from(
          new Set(inv.map((r) => String(r.location ?? "")).filter(Boolean))
        ).sort();

        setLocations(uniq);
      } catch (e) {
        console.warn("[transfer] loadInventory error:", e);
      } finally {
        if (alive) setInvLoading(false);
      }
    }

    if (token) loadInventory();
    return () => {
      alive = false;
    };
  }, [token]);

  function openScan(target: "location") {
    router.push({
      pathname: "/scan",
      params: {
        target,
        returnTo: "transfer",
        // passthrough (초기화 금지)
        item_id: itemId,
        from_location: fromLoc,
        to_location: toLoc,
        quantity: String(quantity),
        memo,
      },
    });
  }

  async function onSubmit() {
    if (!token) {
      Alert.alert("토큰이 없습니다", "다시 로그인해 주세요.");
      router.replace("/login");
      return;
    }
    if (!itemId) {
      Alert.alert("이관 실패", "item_id가 없습니다. 재고 상세에서 다시 진입하세요.");
      return;
    }
    if (!fromLoc.trim() || !toLoc.trim()) {
      Alert.alert("입력 필요", "보내는곳(from) / 받는곳(to)을 입력해 주세요.");
      return;
    }
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) {
      Alert.alert("수량 오류", "수량은 1 이상이어야 합니다.");
      return;
    }

    // meta가 아직 로드 중이면 잠시 막음(필드 누락 방지)
    if (metaLoading) {
      Alert.alert("잠시만요", "품목 정보를 불러오는 중입니다.");
      return;
    }
    if (!meta?.artist || !meta?.category || !meta?.album_version) {
      Alert.alert(
        "이관 실패",
        "품목 메타정보를 불러오지 못했습니다. 재고 상세에서 다시 진입 후 시도해 주세요."
      );
      return;
    }

    // ✅ 핵심: 웹 세션/쿠키가 아닌 Bearer 토큰 기반 “모바일 API”로 전송
    const payload = {
      item_id: itemId,
      from_location: fromLoc.trim(),
      to_location: toLoc.trim(),
      quantity: q,
      memo: memo.trim() || null,

      // 서버 검증용(누락 시 400 missing fields 나오던 부분)
      artist: meta.artist,
      category: meta.category,
      album_version: meta.album_version,
      option: meta.option ?? null,

      idempotencyKey: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };

    try {
      const res = await fetch(`${BASE}/api/mobile/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // ignore
      }

      if (!res.ok) {
        const msg =
          json?.error
            ? String(json.error)
            : text
            ? String(text).slice(0, 200)
            : `HTTP ${res.status}`;
        Alert.alert("이관 실패", `${res.status}\n${msg}`);
        return;
      }

      Alert.alert("완료", "이관 등록되었습니다.");
      router.replace("/inventory");
    } catch (err: any) {
      Alert.alert("이관 실패", err?.message ?? String(err));
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#000", marginBottom: 12 }}>
          {title}
        </Text>

        <Text style={{ fontWeight: "700", color: "#000", marginBottom: 6 }}>전산 이관</Text>

        <Text style={{ color: "#000", marginBottom: 6 }}>보내는곳(from)</Text>
        <TextInput
          value={fromLoc}
          onChangeText={setFromLoc}
          placeholder="from"
          placeholderTextColor="#666"
          autoCapitalize="none"
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 10,
            padding: 12,
            color: "#000",
            marginBottom: 10,
          }}
        />

        <Text style={{ color: "#000", marginBottom: 6 }}>받는곳(to)</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <TextInput
              value={toLoc}
              onChangeText={setToLoc}
              placeholder="to"
              placeholderTextColor="#666"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 10,
                padding: 12,
                color: "#000",
              }}
            />
          </View>
          <Pressable
            onPress={() => openScan("location")}
            style={{
              backgroundColor: "#0B4A6F",
              paddingHorizontal: 14,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>로케이션 스캔</Text>
          </Pressable>
        </View>

        <Text style={{ color: "#000", marginBottom: 6 }}>수량</Text>
        <TextInput
          value={String(quantity)}
          onChangeText={(v) => setQuantity(Number(v))}
          placeholder="수량"
          placeholderTextColor="#666"
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 10,
            padding: 12,
            color: "#000",
            marginBottom: 10,
          }}
        />

        <Text style={{ color: "#000", marginBottom: 6 }}>메모</Text>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="memo"
          placeholderTextColor="#666"
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 10,
            padding: 12,
            color: "#000",
            marginBottom: 14,
          }}
        />

        {(metaLoading || invLoading) && (
          <View style={{ paddingVertical: 10 }}>
            <ActivityIndicator />
          </View>
        )}

        {/* ✅ 버튼은 파란색 유지 */}
        <Pressable
          onPress={onSubmit}
          style={{
            backgroundColor: "#0B4A6F",
            paddingVertical: 14,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>이관 등록</Text>
        </Pressable>

        <View style={{ height: 10 }} />
        <Button title="재고조회로" onPress={() => router.replace("/inventory")} />
      </ScrollView>
    </SafeAreaView>
  );
}
