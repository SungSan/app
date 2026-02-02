// app/item.tsx
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

const BASE = process.env.EXPO_PUBLIC_API_BASE;

type Direction = "in" | "out";

export default function Item() {
  const token = useAccessToken();
  const params = useLocalSearchParams();

  const mode = String(params.mode ?? "");
  const direction: Direction = (String(params.direction ?? "in") as Direction) || "in";

  const [barcode, setBarcode] = useState(String(params.barcode ?? ""));
  const [location, setLocation] = useState(String(params.location ?? ""));
  const [artist, setArtist] = useState(String(params.artist ?? ""));
  const [category, setCategory] = useState(String(params.category ?? "md"));
  const [albumVersion, setAlbumVersion] = useState(String(params.album_version ?? ""));
  const [option, setOption] = useState(String(params.option ?? ""));
  const [quantity, setQuantity] = useState(Number(params.quantity ?? 1));
  const [memo, setMemo] = useState(String(params.memo ?? ""));

  const [loading, setLoading] = useState(false);

  const title = useMemo(() => {
    if (direction === "out") return "출고";
    return mode === "quick-in" ? "빠른입고" : "일반입고";
  }, [direction, mode]);

  useEffect(() => {
    // scan.tsx passthrough로 되돌아왔을 때 값 유지되는 구조
    // 여기서는 별도 초기화 로직 없음(요구사항: 초기화 금지)
  }, []);

  async function postWithCandidates(urls: string[], body: any) {
    let lastErr: any = null;

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });

        const text = await res.text();
        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          // ignore json parse error
        }

        if (res.ok) return { ok: true, json, status: res.status };
        lastErr = { ok: false, status: res.status, text, json };
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr ?? new Error("request failed");
  }

  async function onSubmit() {
    if (!token) {
      Alert.alert("토큰이 없습니다", "다시 로그인해 주세요.");
      router.replace("/login");
      return;
    }

    const q = Number(quantity);
    if (!barcode.trim()) {
      Alert.alert("입력 필요", "바코드를 입력/스캔해 주세요.");
      return;
    }
    if (!location.trim()) {
      Alert.alert("입력 필요", "로케이션을 입력/스캔해 주세요.");
      return;
    }
    if (!artist.trim()) {
      Alert.alert("입력 필요", "아티스트를 입력해 주세요.");
      return;
    }
    if (!category.trim()) {
      Alert.alert("입력 필요", "카테고리를 선택해 주세요.");
      return;
    }
    if (!albumVersion.trim()) {
      Alert.alert("입력 필요", "앨범/버전을 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(q) || q <= 0) {
      Alert.alert("수량 오류", "수량은 1 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        barcode: barcode.trim(),
        artist: artist.trim(),
        category: category.trim(),
        album_version: albumVersion.trim(),
        option: option.trim() || null,
        location: location.trim(),
        quantity: q,
        direction,
        memo: memo.trim() || null,
        // idempotencyKey는 서버가 지원 시 사용 (있어도 무방)
        idempotencyKey: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      };

      // ✅ 405 해결: 모바일 전용 라우트로 POST
      // (구버전 호환) /api/record_movement 가 남아있으면 fallback
      const candidates = [
        `${BASE}/api/mobile/movements`,
        `${BASE}/api/record_movement`,
      ];

      const r = await postWithCandidates(candidates, payload);
      if (!r.ok) {
        Alert.alert("등록 실패", "요청이 실패했습니다.");
        return;
      }

      Alert.alert("완료", "등록되었습니다.");

      // ✅ 빠른입고: 등록 후 자동으로 바코드 스캔 다시 열기 (기존 값 초기화 금지)
      if (mode === "quick-in") {
        setBarcode("");
        router.push({
          pathname: "/scan",
          params: {
            target: "barcode",
            returnTo: "item",
            mode,
            direction,
            // passthrough (scan.tsx가 그대로 다시 붙여줌)
            artist,
            category,
            album_version: albumVersion,
            option,
            location,
            quantity: String(quantity),
            memo,
          },
        });
        return;
      }

      router.replace("/inventory");
    } catch (err: any) {
      const msg =
        err?.json?.error
          ? `${err.json.error}`
          : err?.text
          ? String(err.text).slice(0, 200)
          : err?.message ?? String(err);

      // 405 / 403 등도 그대로 노출
      Alert.alert("등록 실패", msg);
    } finally {
      setLoading(false);
    }
  }

  function openScan(target: "barcode" | "location") {
    router.push({
      pathname: "/scan",
      params: {
        target,
        returnTo: "item",
        mode,
        direction,
        // passthrough (초기화 금지)
        barcode,
        artist,
        category,
        album_version: albumVersion,
        option,
        location,
        quantity: String(quantity),
        memo,
      },
    });
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#000", marginBottom: 12 }}>
          {title}
        </Text>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Pressable
              onPress={() => openScan("barcode")}
              style={{
                backgroundColor: "#0B4A6F",
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>바코드 스캔</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Pressable
              onPress={() => openScan("location")}
              style={{
                backgroundColor: "#0B4A6F",
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>로케이션 스캔</Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          value={barcode}
          onChangeText={setBarcode}
          placeholder="바코드"
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

        <Text style={{ fontWeight: "700", color: "#000", marginBottom: 6 }}>카테고리 (필수)</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <Pressable
            onPress={() => setCategory("md")}
            style={{
              flex: 1,
              backgroundColor: category === "md" ? "#0B4A6F" : "#E5E7EB",
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: category === "md" ? "#fff" : "#000", fontWeight: "700" }}>
              MD {category === "md" ? "✓" : ""}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setCategory("album")}
            style={{
              flex: 1,
              backgroundColor: category === "album" ? "#0B4A6F" : "#E5E7EB",
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: category === "album" ? "#fff" : "#000", fontWeight: "700" }}>
              ALBUM {category === "album" ? "✓" : ""}
            </Text>
          </Pressable>
        </View>

        <TextInput
          value={artist}
          onChangeText={setArtist}
          placeholder="아티스트"
          placeholderTextColor="#666"
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
          value={albumVersion}
          onChangeText={setAlbumVersion}
          placeholder="앨범/버전"
          placeholderTextColor="#666"
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
          value={option}
          onChangeText={setOption}
          placeholder="옵션(선택)"
          placeholderTextColor="#666"
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
          value={location}
          onChangeText={setLocation}
          placeholder="로케이션"
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

        {loading ? (
          <View style={{ paddingVertical: 10 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={loading}
          style={{
            backgroundColor: "#0B4A6F",
            paddingVertical: 14,
            borderRadius: 10,
            alignItems: "center",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>
            {direction === "out" ? "출고" : "입고"}
          </Text>
        </Pressable>

        <View style={{ height: 10 }} />
        <Button title="메인화면으로" onPress={() => router.replace("/inventory")} />
      </ScrollView>
    </SafeAreaView>
  );
}

