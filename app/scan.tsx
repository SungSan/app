// app/scan.tsx
import React, { useState } from "react";
import { Button, SafeAreaView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";

export default function Scan() {
  const p = useLocalSearchParams<{
    target?: string; // "q" | "barcode" | "location" | "to_location" | "from_location"
    returnTo?: string; // "item" | "transfer"
    mode?: string;
    direction?: string;

    // ✅ passthrough (초기화 방지)
    item_id?: string;
    artist?: string;
    category?: string;
    album_version?: string;
    option?: string;
    location?: string;
    barcode?: string;
    quantity?: string;
    memo?: string;

    from_location?: string;
    to_location?: string;
  }>();

  const target = String(p.target ?? "q");
  const returnTo = String(p.returnTo ?? "");
  const mode = typeof p.mode === "string" ? p.mode : undefined;
  const direction = typeof p.direction === "string" ? p.direction : undefined;

  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16, backgroundColor: "#fff" }}>
        <Text style={{ color: "#000", marginBottom: 10 }}>카메라 권한이 필요합니다.</Text>
        <Button title="권한 요청" onPress={requestPermission} />
        <View style={{ height: 10 }} />
        <Button title="뒤로" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (locked) return;
    setLocked(true);

    const code = (data || "").trim();
    if (!code) {
      setLocked(false);
      return;
    }

    // 1) 메인 검색(q)
    if (!returnTo) {
      router.replace({ pathname: "/inventory", params: { q: code } });
      return;
    }

    // 2) item 화면으로 복귀 (✅ passthrough)
    if (returnTo === "item") {
      router.replace({
        pathname: "/item",
        params: {
          mode,
          direction,
          scanTarget: target,
          scanned: code,

          // ✅ 초기화 방지
          item_id: String(p.item_id ?? ""),
          artist: String(p.artist ?? ""),
          category: String(p.category ?? ""),
          album_version: String(p.album_version ?? ""),
          option: String(p.option ?? ""),
          location: String(p.location ?? ""),
          barcode: String(p.barcode ?? ""),
          quantity: String(p.quantity ?? ""),
          memo: String(p.memo ?? ""),
        },
      });
      return;
    }

    // 3) transfer 화면으로 복귀 (✅ from/to 유지)
    if (returnTo === "transfer") {
      router.replace({
        pathname: "/transfer",
        params: {
          scanTarget: target,
          scanned: code,
          from_location: String(p.from_location ?? ""),
          to_location: String(p.to_location ?? ""),
        },
      });
      return;
    }

    router.replace({ pathname: "/inventory", params: { q: code } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>스캔 ({target})</Text>
        <Button title="취소" onPress={() => router.back()} />
      </View>

      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
          }}
          onBarcodeScanned={onBarcodeScanned}
        />
      </View>
    </SafeAreaView>
  );
}
