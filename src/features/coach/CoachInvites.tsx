import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  dedupeActiveCoachWriterLinks,
  devSnapshotCoachLinkRow,
} from "../../coachShare/coachLinkBinding";
import {
  inviteLinkTokenTail,
  normalizeInviteLinkToken,
} from "../../coachShare/inviteLinkToken";
import { getCoachSyncApiBaseUrl, isCoachSyncConfigured } from "../../config/coachSync";
import {
  CoachWeeklySyncApiError,
  coachSyncCreateSession,
  coachSyncFetchSession,
} from "../../services/coachWeeklySyncApi";
import {
  getCoachLinks,
  getCoachesById,
  getOrCreateLocalParentProfileId,
  setCoachLinks,
  setCoachesById,
} from "../../storage/coachShareStore";
import { clearLocalCoachSharingBindingsForInviteToken } from "../../storage/coachKidStore";
import type { CoachIdentity, CoachLink } from "../../types/coachShare";

type InviteSessionAthletesState = { names: string[]; fetchFailed: boolean };

const UI = {
  bgCard: "#171b20",
  border: "#26303a",
  fieldBg: "#20252b",
  fieldBorder: "#28313c",
  textPrimary: "#ffffff",
  textSecondary: "#9ca3af",
  action: "#d4ad4f",
};

function formatInviteLinkedAthletesLine(info: InviteSessionAthletesState | undefined): string {
  if (!info) return "Linked athletes unavailable";
  if (info.fetchFailed) return "Couldn’t load linked athletes";
  if (info.names.length === 0) return "No athletes linked yet";
  return `${info.names.length} linked athlete${info.names.length === 1 ? "" : "s"}`;
}

function sortLinksNewestFirst(links: CoachLink[]): CoachLink[] {
  return [...links].sort((a, b) => {
    const created = b.createdAt.localeCompare(a.createdAt);
    if (created !== 0) return created;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export default function CoachInvites() {
  const [writerLinks, setWriterLinks] = useState<CoachLink[]>([]);
  const [coachNameDraft, setCoachNameDraft] = useState("");
  const [academyDraft, setAcademyDraft] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [inviteSessionAthletesByToken, setInviteSessionAthletesByToken] = useState<
    Record<string, InviteSessionAthletesState>
  >({});
  const syncConfigured = isCoachSyncConfigured();

  const loadInvites = useCallback(async () => {
    const links = await getCoachLinks();
    const syncLinks = links.filter((link) => Boolean(link.weeklySync?.linkToken?.trim()));
    setWriterLinks(syncLinks);

    const activeWriters = dedupeActiveCoachWriterLinks(links);
    const athletesByToken: Record<string, InviteSessionAthletesState> = {};

    if (syncConfigured) {
      for (const link of activeWriters) {
        const weeklySync = link.weeklySync!;
        const tokenKey = normalizeInviteLinkToken(weeklySync.linkToken);

        try {
          const session = await coachSyncFetchSession(
            weeklySync.linkToken,
            weeklySync.apiBaseUrl,
          );
          const names = session.athletes
            .map((athlete) => (typeof athlete.name === "string" ? athlete.name.trim() : ""))
            .filter(Boolean);
          names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
          athletesByToken[tokenKey] = { names, fetchFailed: false };
        } catch {
          athletesByToken[tokenKey] = { names: [], fetchFailed: true };
        }
      }
    }

    setInviteSessionAthletesByToken(athletesByToken);
  }, [syncConfigured]);

  useFocusEffect(
    useCallback(() => {
      void loadInvites();
    }, [loadInvites]),
  );

  const sortedWriterLinks = useMemo(() => sortLinksNewestFirst(writerLinks), [writerLinks]);
  const activeInvite = useMemo(
    () => sortedWriterLinks.find((link) => link.status === "active") ?? null,
    [sortedWriterLinks],
  );
  const pastInvites = useMemo(
    () => sortedWriterLinks.filter((link) => link.id !== activeInvite?.id),
    [activeInvite?.id, sortedWriterLinks],
  );

  const requestArchiveWriterLink = useCallback(
    (link: CoachLink) => {
      const tail = (link.weeklySync?.linkToken ?? "").trim();
      const preview = tail.length > 12 ? `${tail.slice(0, 6)}…${tail.slice(-4)}` : tail || "this invite";

      Alert.alert(
        "Archive invite?",
        `Remove ${preview} from this device? Parents who already joined keep their link until they disconnect. You can create a new invite anytime.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Archive",
            style: "destructive",
            onPress: async () => {
              const nowIso = new Date().toISOString();
              const all = await getCoachLinks();
              const next = all.map((existingLink) =>
                existingLink.id === link.id
                  ? {
                      ...existingLink,
                      status: "revoked" as const,
                      revokedAt: nowIso,
                      updatedAt: nowIso,
                    }
                  : existingLink,
              );

              await setCoachLinks(next);

              const tokenRaw = link.weeklySync?.linkToken;
              if (tokenRaw) await clearLocalCoachSharingBindingsForInviteToken(tokenRaw);

              setPastExpanded(false);
              await loadInvites();
            },
          },
        ],
      );
    },
    [loadInvites],
  );

  const onCreateFamilyInvite = useCallback(async () => {
    const display = coachNameDraft.trim() || "Coach";

    if (!syncConfigured) {
      Alert.alert("Invites unavailable", "Invites are not available in this build yet.");
      return;
    }

    setCreatingInvite(true);
    try {
      const res = await coachSyncCreateSession({
        coachDisplayName: display,
        academyName: academyDraft.trim() ? academyDraft.trim().slice(0, 160) : undefined,
      });
      const nowIso = new Date().toISOString();
      const parentProfileId = await getOrCreateLocalParentProfileId();
      const baseUrl = getCoachSyncApiBaseUrl()!;

      const coach: CoachIdentity = {
        id: res.coachId,
        displayName: display,
        academyName: academyDraft.trim() ? academyDraft.trim().slice(0, 160) : undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const newLink: CoachLink = {
        id: `link_sync_writer_${Date.now()}`,
        coachId: res.coachId,
        parentProfileId,
        scope: "household",
        status: "active",
        canReceiveCompletionReceipts: false,
        createdAt: nowIso,
        updatedAt: nowIso,
        weeklySync: {
          apiBaseUrl: baseUrl,
          linkToken: res.linkToken,
          writerSecret: res.writerSecret,
        },
      };

      const existingCoaches = await getCoachesById();
      const existingLinks = await getCoachLinks();
      const newNorm = normalizeInviteLinkToken(res.linkToken);
      const newTail = inviteLinkTokenTail(res.linkToken);

      if (__DEV__) {
        const sameNormBefore = existingLinks.filter(
          (link) =>
            link.status === "active" &&
            Boolean(link.weeklySync?.linkToken?.trim()) &&
            normalizeInviteLinkToken(link.weeklySync!.linkToken) === newNorm,
        );
        console.log("[mm:autoRelink]", {
          step: "coach_create_invite",
          phase: "before",
          rows: existingLinks.map(devSnapshotCoachLinkRow),
          newInviteTokenTail: newTail,
          newInviteTokenNorm: newNorm,
          existingActiveRowsSameNormCount: sameNormBefore.length,
        });
      }

      await setCoachesById({ ...existingCoaches, [coach.id]: coach });
      await setCoachLinks([...existingLinks, newLink]);

      if (__DEV__) {
        const afterLinks = await getCoachLinks();
        const sameNormOtherIds = afterLinks.filter(
          (link) =>
            link.id !== newLink.id &&
            link.status === "active" &&
            Boolean(link.weeklySync?.linkToken?.trim()) &&
            normalizeInviteLinkToken(link.weeklySync!.linkToken) === newNorm,
        );
        console.log("[mm:autoRelink]", {
          step: "coach_create_invite",
          phase: "after",
          rows: afterLinks.map(devSnapshotCoachLinkRow),
          newLinkId: newLink.id,
          newInviteTokenTail: newTail,
          storageMutation: "append_new_row",
          otherActiveRowsSameNormCount: sameNormOtherIds.length,
        });
      }

      await loadInvites();
      Alert.alert(
        "Invite ready",
        "Share this code with a parent device from their weekly screen. This links them to this coach’s weekly family note channel.",
      );
    } catch (error) {
      const message =
        error instanceof CoachWeeklySyncApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not create invite.";
      Alert.alert("Could not create invite", message);
    } finally {
      setCreatingInvite(false);
    }
  }, [academyDraft, coachNameDraft, loadInvites, syncConfigured]);

  return (
    <View style={styles.container}>
      {!syncConfigured ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>Invites are not available in this build yet.</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Active Invite</Text>

        {activeInvite ? (
          <InviteRow
            inviteSessionAthletesByToken={inviteSessionAthletesByToken}
            link={activeInvite}
            onArchive={requestArchiveWriterLink}
            prominent
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No invites yet</Text>
            <Text style={styles.emptyText}>Create a family invite when you are ready to connect a parent device.</Text>
          </View>
        )}

        {syncConfigured ? (
          <View style={styles.createBlock}>
            <TextInput
              value={coachNameDraft}
              onChangeText={setCoachNameDraft}
              placeholder="Your name as families see it"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="words"
              style={styles.input}
            />
            <TextInput
              value={academyDraft}
              onChangeText={setAcademyDraft}
              placeholder="Academy name (optional)"
              placeholderTextColor={UI.textSecondary}
              autoCapitalize="words"
              style={styles.input}
            />

            <Pressable
              disabled={creatingInvite}
              onPress={() => void onCreateFamilyInvite()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : null,
                creatingInvite ? styles.disabled : null,
              ]}
            >
              {creatingInvite ? <ActivityIndicator color="#111827" /> : null}
              <Text style={styles.primaryButtonText}>
                {creatingInvite
                  ? "Creating…"
                  : activeInvite
                    ? "Create another invite"
                    : "Create first invite"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {pastInvites.length > 0 ? (
        <View style={styles.card}>
          <Pressable
            onPress={() => setPastExpanded((value) => !value)}
            style={({ pressed }) => [
              styles.pastHeader,
              pressed ? styles.secondaryButtonPressed : null,
            ]}
          >
            <View>
              <Text style={styles.eyebrow}>Past Invites</Text>
              <Text style={styles.pastTitle}>{pastInvites.length} previous</Text>
            </View>
            <Text style={styles.pastToggle}>{pastExpanded ? "Hide" : "Show"}</Text>
          </Pressable>

          {pastExpanded ? (
            <View style={styles.pastList}>
              {pastInvites.map((link) => (
                <InviteRow
                  key={link.id}
                  inviteSessionAthletesByToken={inviteSessionAthletesByToken}
                  link={link}
                  onArchive={requestArchiveWriterLink}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function InviteRow({
  inviteSessionAthletesByToken,
  link,
  onArchive,
  prominent,
}: {
  inviteSessionAthletesByToken: Record<string, InviteSessionAthletesState>;
  link: CoachLink;
  onArchive: (link: CoachLink) => void;
  prominent?: boolean;
}) {
  const linkToken = link.weeklySync!.linkToken;
  const linkedLine = formatInviteLinkedAthletesLine(
    inviteSessionAthletesByToken[normalizeInviteLinkToken(linkToken)],
  );

  return (
    <View style={[styles.inviteRow, prominent ? styles.inviteRowProminent : null]}>
      <View style={styles.inviteMetaRow}>
        <Text style={styles.inviteStatus}>{link.status}</Text>
        <Text style={styles.inviteDate}>{link.createdAt.slice(0, 10)}</Text>
      </View>
      <Text selectable style={prominent ? styles.inviteTokenLarge : styles.inviteToken}>
        {linkToken}
      </Text>
      <Text style={styles.inviteLinkedLine}>{linkedLine}</Text>
      {link.status === "active" ? (
        <Pressable
          onPress={() => onArchive(link)}
          style={({ pressed }) => [styles.archiveButton, pressed ? styles.disabled : null]}
        >
          <Text style={styles.archiveButtonText}>Archive invite</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    backgroundColor: UI.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: UI.border,
    padding: 16,
    gap: 12,
  },
  noticeCard: {
    backgroundColor: "#2a2115",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4d3d1d",
    padding: 14,
  },
  noticeText: {
    color: "#f8d58a",
    fontSize: 13,
    lineHeight: 19,
  },
  eyebrow: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  emptyState: {
    backgroundColor: UI.fieldBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.fieldBorder,
    padding: 14,
  },
  emptyTitle: {
    color: UI.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },
  emptyText: {
    color: UI.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  createBlock: {
    gap: 12,
  },
  input: {
    backgroundColor: UI.fieldBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.fieldBorder,
    color: UI.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  primaryButton: {
    backgroundColor: UI.action,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryButtonPressed: {
    backgroundColor: "#b9903f",
  },
  primaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  inviteRow: {
    backgroundColor: UI.fieldBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.fieldBorder,
    padding: 12,
  },
  inviteRowProminent: {
    borderColor: UI.action,
    padding: 14,
  },
  inviteMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  inviteStatus: {
    color: UI.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  inviteDate: {
    color: UI.textSecondary,
    fontSize: 12,
  },
  inviteToken: {
    color: UI.textPrimary,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 13,
  },
  inviteTokenLarge: {
    color: UI.textPrimary,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 15,
    fontWeight: "700",
  },
  inviteLinkedLine: {
    color: UI.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  archiveButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 6,
  },
  archiveButtonText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "800",
  },
  pastHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  pastTitle: {
    color: UI.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  pastToggle: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: "800",
  },
  pastList: {
    gap: 10,
  },
  secondaryButtonPressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.65,
  },
});
