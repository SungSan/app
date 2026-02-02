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

  const pushItem = (args: { mode: string; direction: "IN" | "OUT" }) => {
    if (!ensure()) return;
    router.push({
      pathname: "/item",
      params: {
        mode: args.mode,
        direction: args.direction,
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

  const goQuickIn = () => pushItem({ mode: "quick-in", direction: "IN" });
  const goIn = () => pushItem({ mode: "movement", direction: "IN" });
  const goOut = () => pushItem({ mode: "movement", direction: "OUT" });

  const goTransfer = () => {
    if (!ensure()) return;
    router.push({
      pathname: "/transfer",
      params: {
        item_id: item.item_id,        // ✅ 이관에 item_id 전달 (필수)
        from_location: item.location,
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>재고 상세</Text>

        <View style={{ padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 12, backgroundColor: "#fff" }}>
          <Text style={{ fontWeight: "700", color: "#000" }}>
            {item.artist} / {item.album_version}
          </Text>
          <Text style={{ color: "#000" }}>
            {item.category}
            {item.option ? ` / ${item.option}` : ""}
          </Text>
          <Text style={{ color: "#000" }}>로케이션: {item.location}</Text>
          <Text style={{ color: "#000" }}>수량: {item.quantity}</Text>
        </View>

        {/* ✅ 원복: 빠른입고 / 일반입고 / 출고 / 전산이관 */}
        <Button title="빠른입고" onPress={goQuickIn} />
        <Button title="일반입고" onPress={goIn} />
        <Button title="출고" onPress={goOut} />
        <Button title="전산 이관" onPress={goTransfer} />

        <Button title="재고조회로" onPress={() => router.replace("/inventory")} />
      </ScrollView>
    </SafeAreaView>
  );
}
