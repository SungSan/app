// app/_layout.tsx
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }} initialRouteName="index">
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: "로그인" }} />
      <Stack.Screen name="inventory" options={{ title: "재고 조회" }} />
      <Stack.Screen name="item" options={{ title: "입/출고" }} />
      <Stack.Screen name="transfer" options={{ title: "전산 이관" }} />
      <Stack.Screen name="scan" options={{ title: "스캔" }} />
    </Stack>
  );
}
