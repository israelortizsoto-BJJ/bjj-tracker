import { StyleSheet, Text, View } from "react-native";

type IdentityHeroProps = {
  identityName: string;
  mode: string;
  confidence: number;
  subtitle: string;
  topChain?: string;
};

export default function IdentityHero({ identityName, mode, confidence, subtitle, topChain }: IdentityHeroProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardGlow} />
      <View style={styles.topRow}>
        <View style={styles.modePill}>
          <Text style={styles.modeText}>{mode}</Text>
        </View>
        <Text style={styles.confidence}>{confidence}% Confidence</Text>
      </View>

      <View style={styles.identityBlock}>
        <Text style={styles.identity}>{identityName}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {topChain ? (
          <View style={styles.topChainBlock}>
            <Text style={styles.topChainLabel}>Top Chain</Text>
            <Text style={styles.topChainValue}>{topChain}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bodyRow}>
        <View style={styles.ring}>
          <View style={styles.ringGlowOuter} />
          <View style={styles.ringGlowInner} />
          <View style={styles.ringTrack} />
          <View style={styles.ringArcGreen} />
          <View style={styles.ringArcBlue} />
          <View style={styles.ringInner}>
            <Text style={styles.ringNumber}>{confidence}</Text>
          </View>
        </View>

        <View style={styles.identityPanel}>
          <Text style={styles.panelLabel}>Game Identity</Text>
          <Text style={styles.panelTitle}>Pressure first. Finish fast.</Text>
          <Text style={styles.panelCopy}>Your identity updates as training logs and choices compound.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111820",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#203042",
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.38,
    shadowRadius: 28,
    elevation: 10,
  },
  cardGlow: {
    backgroundColor: "#123042",
    borderRadius: 160,
    height: 190,
    opacity: 0.32,
    position: "absolute",
    right: -82,
    top: -96,
    width: 190,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  modePill: {
    backgroundColor: "#0B0D10",
    borderColor: "#244052",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  modeText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  confidence: {
    color: "#B7C1CE",
    fontSize: 12,
    fontWeight: "800",
  },
  identityBlock: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  identity: {
    color: "#F9FAFB",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 39,
    textAlign: "center",
  },
  subtitle: {
    color: "#A7B0BD",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 300,
    textAlign: "center",
  },
  topChainBlock: {
    alignItems: "center",
    marginTop: 14,
    maxWidth: 300,
  },
  topChainLabel: {
    color: "#FACC15",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textAlign: "center",
    textTransform: "uppercase",
  },
  topChainValue: {
    color: "#E8EDF5",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
    marginTop: 4,
    textAlign: "center",
  },
  bodyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    marginTop: 24,
  },
  ring: {
    alignItems: "center",
    height: 118,
    justifyContent: "center",
    width: 118,
  },
  ringGlowOuter: {
    backgroundColor: "#2563EB",
    borderRadius: 58,
    height: 116,
    opacity: 0.16,
    position: "absolute",
    width: 116,
  },
  ringGlowInner: {
    backgroundColor: "#34D399",
    borderRadius: 49,
    height: 98,
    opacity: 0.12,
    position: "absolute",
    width: 98,
  },
  ringTrack: {
    ...StyleSheet.absoluteFillObject,
    borderColor: "#213041",
    borderRadius: 59,
    borderWidth: 12,
  },
  ringArcGreen: {
    ...StyleSheet.absoluteFillObject,
    borderColor: "#34D399",
    borderLeftColor: "transparent",
    borderRadius: 59,
    borderWidth: 12,
    transform: [{ rotate: "34deg" }],
  },
  ringArcBlue: {
    ...StyleSheet.absoluteFillObject,
    borderBottomColor: "transparent",
    borderColor: "#38BDF8",
    borderLeftColor: "transparent",
    borderRadius: 59,
    borderRightColor: "transparent",
    borderWidth: 12,
    transform: [{ rotate: "-42deg" }],
  },
  ringInner: {
    alignItems: "center",
    backgroundColor: "#0B0D10",
    borderColor: "#1F2937",
    borderRadius: 40,
    borderWidth: 1,
    height: 80,
    justifyContent: "center",
    shadowColor: "#34D399",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: 80,
  },
  ringNumber: {
    color: "#F9FAFB",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 27,
  },
  identityPanel: {
    backgroundColor: "#0D1218",
    borderColor: "#243244",
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    padding: 15,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  panelLabel: {
    color: "#FACC15",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  panelTitle: {
    color: "#F9FAFB",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 21,
    marginTop: 6,
  },
  panelCopy: {
    color: "#A7B0BD",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 6,
  },
});
