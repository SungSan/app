// app/scan.tsx
import React, { useState } from "react";
import { Button, SafeAreaView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";

export default function Scan() {
  const p = useLocalSearchParams<{
    target?: string; // "q" | "barcode" | "location" | "to_location"
    returnTo?: string; // "item" | "transfer"
    mode?: string;
    direction?: string;
  }>();

  const target = String(p.target ?? "q");
  const returnTo = String(p.returnTo ?? ""); // empty면 inventory로 복귀

  const mode = typeof p.mode === "string" ? p.mode : undefined;
  const direction = typeof p.direction === "string" ? p.direction : undefined;

  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16, gap: 8 }}>
        <Text>카메라 권한이 필요합니다.</Text>
        <Button title="권한 요청" onPress={requestPermission} />
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

    // 1) 메인 재고조회 검색(q) 용도
    if (!returnTo) {
      router.replace({ pathname: "/inventory", params: { q: code } });
      return;
    }

    // 2) item 화면으로 복귀(바코드/로케이션)
    if (returnTo === "item") {
      router.replace({
        pathname: "/item",
        params: { mode, direction, scanTarget: target, scanned: code },
      });
      return;
    }

    // 3) transfer 화면으로 복귀(to_location)
    if (returnTo === "transfer") {
      router.replace({
        pathname: "/transfer",
        params: { scanTarget: target, scanned: code },
      });
      return;
    }

    // fallback
    router.replace({ pathname: "/inventory", params: { q: code } });
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "700" }}>스캔 ({target})</Text>
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

