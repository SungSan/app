// app/index.tsx
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useAuthState } from "../lib/session";

export default function Index() {
  const auth = useAuthState();

  useEffect(() => {
    if (auth.status === "loading") return;
    if (auth.status === "signed_out") router.replace("/login");
    if (auth.status === "signed_in") router.replace("/inventory");
  }, [auth.status]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
