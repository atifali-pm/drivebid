import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  auctionEndsAt: string | null;
  bidCount: number;
  lowestBid?: number | null;
}

export function AuctionTimer({ auctionEndsAt, bidCount, lowestBid }: Props) {
  const end = auctionEndsAt ? new Date(auctionEndsAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!end) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [end]);

  if (!end) return null;
  const remaining = Math.max(0, Math.ceil((end - now) / 1000));
  const closed = remaining === 0;

  return (
    <View style={[styles.box, closed ? styles.boxClosed : styles.boxOpen]}>
      <View style={{ flex: 1 }}>
        <Text style={closed ? styles.labelClosed : styles.label}>
          {closed ? "Auction closed" : `Closes in ${remaining}s`}
        </Text>
        <Text style={styles.meta}>
          {bidCount} bid{bidCount === 1 ? "" : "s"}
          {lowestBid != null && ` , lowest Rs ${lowestBid.toLocaleString()}`}
        </Text>
      </View>
      {!closed && (
        <View style={styles.ringOuter}>
          <Text style={styles.ringText}>{remaining}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
  },
  boxOpen: { backgroundColor: "#fff7ed", borderColor: "#fb923c" },
  boxClosed: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" },
  label: { fontSize: 13, fontWeight: "700", color: "#c2410c" },
  labelClosed: { fontSize: 13, fontWeight: "700", color: "#475569" },
  meta: { fontSize: 11, color: "#64748b", marginTop: 2 },
  ringOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#fb923c",
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: { fontSize: 13, fontWeight: "800", color: "#c2410c" },
});
