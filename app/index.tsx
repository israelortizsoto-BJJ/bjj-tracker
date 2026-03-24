import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useDeviceRole } from "../src/deviceRole/DeviceRoleProvider";

export default function Index() {
  const { role, loading } = useDeviceRole();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  if (role === null) {
    return <Redirect href="/role-picker" />;
  }

  return <Redirect href="/welcome" />;
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6" },
});