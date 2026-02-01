// app/inventory-detail.tsx
import React, { useMemo } from "react";
import { Alert, Button, SafeAreaView, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

export default function InventoryDetail() {
  const p = useLocalSearchParams<{
    item_id?: string;
    artist?: string;
    category?: string;
    album_version?: string;
    option?: string;
    location?: string;
    quantity?: string;
    barcode?: string;
  }>();

  const item = useMemo(() => {
    return {
      item_id: String(p.item_id ?? ""),
      artist: String(p.artist ?? ""),
      category: String(p.category ?? ""),
      album_version: String(p.album_version ?? ""),
      option: String(p.option ?? ""),
      location: String(p.location ?? ""),
      quantity: Number(p.quantity ?? "0"),
      barcode: String(p.barcode ?? ""),
    };
  }, [p]);

  const ensure = () => {
    if (!item.item_id) {
      Alert.alert("오류", "item_id가 없습니다. 재고 리스트에서 다시 진입하세요.");
      return false;
    }
    return true;
  };

  const goMovement = (direction: "IN" | "OUT") => {
    if (!ensure()) return;
    router.push({
      pathname: "/item",
      params: {
        mode: "movement",
        direction,
        // 자동 채움
        item_id: item.item_id,
        artist: item.artist,
        category: item.category,
        album_version: item.album_version,
        option: item.option,
        location: item.location,
        barcode: item.barcode,
      },
    });
  };

  const goTransfer = () => {
    if (!ensure()) return;
    router.push({
      pathname: "/transfer",
      params: {
        item_id: item.item_id,
        artist: item.artist,
        category: item.category,
        album_version: item.album_version,
        option: item.option,
        from_location: item.location,
        barcode: item.barcode,
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>재고 상세</Text>

        <View style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, gap: 6 }}>
          <Text style={{ fontWeight: "700" }}>
            {item.artist} / {item.album_version}
          </Text>
          <Text>
            {item.category}
            {item.option ? ` / ${item.option}` : ""}
          </Text>
          <Text>로케이션: {item.location}</Text>
          <Text>수량: {item.quantity}</Text>
          {!!item.barcode && <Text style={{ color: "#666" }}>barcode: {item.barcode}</Text>}
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="입고" onPress={() => goMovement("IN")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="출고" onPress={() => goMovement("OUT")} />
          </View>
        </View>

        <Button title="전산 이관" onPress={goTransfer} />
        <Button title="재고조회로" onPress={() => router.replace("/inventory")} />
      </ScrollView>
    </SafeAreaView>
  );
}
