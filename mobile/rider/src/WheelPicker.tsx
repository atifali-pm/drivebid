import { useEffect, useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

interface WheelPickerProps {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  itemWidth?: number;
  visibleCount?: number;
  formatLabel?: (n: number) => string;
  accent?: string;
  style?: ViewStyle;
}

/**
 * Horizontal scroll wheel picker. Swipe left/right to change the value.
 * We use a horizontal FlatList to avoid gesture conflicts with a parent
 * vertical ScrollView — both directions are orthogonal, so touches reach
 * the wheel reliably on Android, iOS and web.
 */
export function WheelPicker({
  values,
  value,
  onChange,
  itemWidth = 96,
  visibleCount = 3,
  formatLabel,
  accent = "#06b6d4",
  style,
}: WheelPickerProps) {
  const listRef = useRef<FlatList<number> | null>(null);
  const fmt = formatLabel ?? ((n: number) => String(n));

  const pad = Math.floor(visibleCount / 2);
  const selectedIndex = Math.max(0, values.indexOf(value));

  useEffect(() => {
    if (selectedIndex < 0) return;
    listRef.current?.scrollToOffset({
      offset: selectedIndex * itemWidth,
      animated: false,
    });
  }, [selectedIndex, itemWidth]);

  function handleMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / itemWidth);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    if (values[clamped] !== value) {
      onChange(values[clamped]);
    }
  }

  const getItemLayout = (_: unknown, index: number) => ({
    length: itemWidth,
    offset: itemWidth * index,
    index,
  });

  return (
    <View style={[styles.container, style]}>
      <FlatList
        ref={listRef}
        horizontal
        data={values}
        keyExtractor={(n) => String(n)}
        getItemLayout={getItemLayout}
        initialNumToRender={visibleCount * 2}
        windowSize={5}
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleMomentumEnd}
        contentContainerStyle={{ paddingHorizontal: pad * itemWidth }}
        renderItem={({ item, index }) => {
          const active = index === selectedIndex;
          return (
            <Pressable
              style={[styles.item, { width: itemWidth }]}
              onPress={() => {
                if (item !== value) onChange(item);
                listRef.current?.scrollToOffset({
                  offset: index * itemWidth,
                  animated: true,
                });
              }}
            >
              <Text
                style={[
                  styles.itemText,
                  active && {
                    color: accent,
                    fontWeight: "800",
                    fontSize: 20,
                  },
                ]}
              >
                {fmt(item)}
              </Text>
            </Pressable>
          );
        }}
      />
      {/* Center selection frame */}
      <View
        pointerEvents="none"
        style={[
          styles.selectionFrame,
          {
            left: pad * itemWidth,
            width: itemWidth,
            borderColor: accent,
          },
        ]}
      />
      {/* Side fades */}
      <View
        pointerEvents="none"
        style={[styles.fadeLeft, { width: pad * itemWidth }]}
      />
      <View
        pointerEvents="none"
        style={[styles.fadeRight, { width: pad * itemWidth }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 72,
    justifyContent: "center",
  },
  item: {
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    fontSize: 16,
    color: "#94a3b8",
    fontWeight: "500",
  },
  selectionFrame: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderWidth: 2,
    borderRadius: 10,
    backgroundColor: "rgba(6,182,212,0.18)",
  },
  fadeLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(248,250,252,0.85)",
  },
  fadeRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(248,250,252,0.85)",
  },
});
