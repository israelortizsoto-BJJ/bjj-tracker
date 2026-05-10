import { Pressable, StyleSheet, Text, View } from "react-native";

const COLORS = {
  bg: "#111315",
  panel: "#181b1f",
  panel2: "#20242a",
  panel3: "#252a31",
  line: "rgba(236, 241, 245, 0.12)",
  lineStrong: "rgba(236, 241, 245, 0.2)",
  text: "#f2f4f6",
  muted: "#a9b0b8",
  faint: "#777f89",
  accent: "#d6ff3f",
};

export type HeaderAction = {
  label: string;
  icon?: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  selected?: boolean;
  statusColor?: string;
};

type AthleteIdentityChipProps = {
  name: string;
  initials: string;
  meta?: string | null;
};

export function AthleteIdentityChip({
  name,
  initials,
  meta,
}: AthleteIdentityChipProps) {
  return (
    <View style={styles.identityChip}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText} numberOfLines={1}>
          {initials}
        </Text>
      </View>
      <View style={styles.identityTextBlock}>
        <Text style={styles.identityName} numberOfLines={1}>
          {name}
        </Text>
        {meta ? (
          <Text style={styles.identityMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type HeaderActionGroupProps = {
  actions?: HeaderAction[];
};

export function HeaderActionGroup({ actions = [] }: HeaderActionGroupProps) {
  if (actions.length === 0) return null;

  return (
    <View style={styles.actionGroup}>
      {actions.map((action) => {
        const content = action.statusColor ? (
          <View style={[styles.statusDot, { backgroundColor: action.statusColor }]} />
        ) : (
          <Text style={styles.actionIcon}>{action.icon ?? action.label}</Text>
        );

        if (!action.onPress) {
          // Non-interactive status indicator: render as a muted badge, not a button-chromed box,
          // so it doesn't read as tappable next to real action buttons.
          const isStatusBadge = Boolean(action.statusColor);
          return (
            <View
              key={action.label}
              accessibilityRole={isStatusBadge ? "image" : undefined}
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              style={
                isStatusBadge
                  ? styles.statusBadge
                  : [styles.actionButton, action.selected ? styles.actionButtonSelected : null]
              }
            >
              {content}
            </View>
          );
        }

        return (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel ?? action.label}
            disabled={action.disabled}
            hitSlop={8}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.actionButton,
              action.selected ? styles.actionButtonSelected : null,
              pressed ? styles.actionButtonPressed : null,
              action.disabled ? styles.actionButtonDisabled : null,
            ]}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}

export type OperatingHeaderProps = {
  mode: "athlete" | "team";
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  onTitleLongPress?: () => void;
  athlete?: AthleteIdentityChipProps | null;
  teamLabel?: string;
  teamMeta?: string | null;
  actions?: HeaderAction[];
};

export default function OperatingHeader({
  mode,
  eyebrow,
  title,
  subtitle,
  onTitleLongPress,
  athlete,
  teamLabel = "MatMind Coach",
  teamMeta,
  actions,
}: OperatingHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {mode === "athlete" && athlete ? (
          <AthleteIdentityChip {...athlete} />
        ) : (
          <View style={styles.teamContext}>
            <View style={styles.teamMark}>
              <Text style={styles.teamMarkText}>MM</Text>
            </View>
            <View style={styles.identityTextBlock}>
              <Text style={styles.identityName} numberOfLines={1}>
                {teamLabel}
              </Text>
              {teamMeta ? (
                <Text style={styles.identityMeta} numberOfLines={1}>
                  {teamMeta}
                </Text>
              ) : null}
            </View>
          </View>
        )}
        <HeaderActionGroup actions={actions} />
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text onLongPress={onTitleLongPress} style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bg,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 38,
  },
  identityChip: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  teamContext: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: COLORS.panel2,
    borderColor: COLORS.line,
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "900",
  },
  teamMark: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  teamMarkText: {
    color: "#111315",
    fontSize: 11,
    fontWeight: "900",
  },
  identityTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 18,
  },
  identityMeta: {
    color: COLORS.faint,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    marginTop: 1,
  },
  actionGroup: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 8,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: COLORS.line,
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  actionButtonSelected: {
    backgroundColor: COLORS.panel3,
    borderColor: COLORS.lineStrong,
  },
  actionButtonPressed: {
    backgroundColor: COLORS.panel3,
  },
  actionButtonDisabled: {
    opacity: 0.42,
  },
  actionIcon: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
  },
  statusBadge: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 24,
  },
  statusDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  titleBlock: {
    marginTop: 18,
  },
  eyebrow: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 34,
    marginTop: 5,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
});
