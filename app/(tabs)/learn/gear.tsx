import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Gear() {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Gear & hygiene" }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          {/* Premium-style header */}
          <View style={styles.header}>
            <Text style={styles.headerLabel}>GEAR & HYGIENE</Text>
            <Text style={styles.title}>Clean gear, happy mats.</Text>
            <Text style={styles.subtitle}>
              A quick guide to keeping kimonos, no-gi gear, and hygiene kid-and-parent friendly
              for close-contact training.
            </Text>
          </View>

          {/* What is a gi? */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>What is a gi?</Text>
            <Text style={styles.cardBody}>
              A gi is the thick kimono (jacket and pants) you wear for jiu-jitsu. It gives training
              partners something safe to grab and helps jiu-jitsu keep the traditional feel shared
              with arts like judo and karate.
            </Text>
            <Text style={styles.cardBody}>
              Your academy may have a preferred color or patch style. If you are ever unsure, just
              ask your professor what is best for your gym.
            </Text>
          </View>

          {/* Belt basics (very simple, not a full tutorial) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Belt basics</Text>
            <Text style={styles.cardBody}>
              Your belt shows your rank and helps keep your kimono closed. The main goal is that it
              sits around your waist with the ends roughly even and the knot snug but comfortable.
            </Text>
            <Text style={styles.cardBody}>
              Everyone ties the belt a little differently. Use this as a reminder, not a full
              tutorial: wrap it around your waist, cross the ends, and tie a simple, flat knot.
              When in doubt, ask your professor or a senior student to help and practice a few
              times.
            </Text>
          </View>

          {/* How to wash your gi */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>How to wash your gi</Text>
            <Text style={styles.cardBody}>
              A clean gi keeps you and your partners healthier. After class, take your gi out of
              your bag as soon as you get home and let it air out or go straight into the wash.
            </Text>
            <Text style={styles.cardBody}>
              On the way home, try to keep your dirty gi in a plastic bag or separate bag before
              putting it back into your gym bag so sweat and smells stay contained.
            </Text>
            <Text style={styles.cardBody}>
              Wash in cold or warm water with mild detergent, and avoid bleach unless your
              professor specifically recommends it. Hang your gi to dry whenever possible instead
              of using high heat, which can shrink or damage the fabric.
            </Text>
            <Text style={styles.cardBody}>
              Try not to wear the same unwashed gi to multiple classes. If you need a backup, talk
              with your professor about simple options over time.
            </Text>
          </View>

          {/* No-gi hygiene basics */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No-gi hygiene basics</Text>
            <Text style={styles.cardBody}>
              For no-gi, most academies expect a fitted rashguard on top and shorts or spats on the
              bottom. Clothes should stay in place while you move and not have zippers or sharp
              edges that can scratch partners.
            </Text>
            <Text style={styles.cardBody}>
              Treat no-gi gear like workout clothes: wash rashguards, shorts, and spats after every
              class. Do not leave them in a closed bag, and avoid re-wearing unwashed gear to the
              next session.
            </Text>
          </View>

          {/* Hygiene checklist before class */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hygiene checklist before class</Text>
            <Text style={styles.cardBody}>
              Helpful basics before stepping on the mat:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • Trim fingernails so they are smooth and not sharp.
              </Text>
              <Text style={styles.bulletItem}>
                • Trim toenails to help prevent scratches and torn nails.
              </Text>
              <Text style={styles.bulletItem}>
                • Wear deodorant if it is age-appropriate and allowed by your parents.
              </Text>
              <Text style={styles.bulletItem}>
                • Brush your teeth or at least have reasonably fresh breath.
              </Text>
              <Text style={styles.bulletItem}>
                • Tie long hair back so it does not cover your face or your partner&apos;s face.
              </Text>
              <Text style={styles.bulletItem}>
                • Come to class clean: a quick shower or at least clean skin, feet, and clothes.
              </Text>
            </View>
            <Text style={styles.cardBody}>
              You do not need to be perfect every day. The goal is to show your partners and
              professor that you are trying to be clean, safe, and respectful.
            </Text>
          </View>

          {/* When not to train */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>When not to train</Text>
            <Text style={styles.cardBody}>
              Staying off the mat sometimes is part of taking care of your teammates and yourself:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• Do not train if you feel sick.</Text>
              <Text style={styles.bulletItem}>
                • Do not train if you feel like you are getting a cold.
              </Text>
              <Text style={styles.bulletItem}>
                • Do not train with a new, unexplained rash or skin change.
              </Text>
              <Text style={styles.bulletItem}>
                • Do not train with anything that might be contagious, even if it seems small.
              </Text>
              <Text style={styles.bulletItem}>
                • If you are unsure, tell your parent and professor and rest instead of training.
              </Text>
            </View>
            <Text style={styles.cardBody}>
              When you stay home to heal, you are protecting your training partners and keeping the
              academy safer for everyone.
            </Text>
          </View>

          {/* Why it matters */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Why it matters</Text>
            <Text style={styles.cardBody}>
              Jiu-jitsu is a close-contact sport. Clean gear and good hygiene help prevent skin
              infections, reduce scratches, and make training more comfortable for everyone on the
              mat.
            </Text>
            <Text style={styles.cardBody}>
              Showing up neat, clean, and ready to train is a simple way to respect your partners,
              professors, and academy. It also helps new kids and parents feel that the gym is a
              safe, professional place to learn.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    marginBottom: 24,
  },
  headerLabel: {
    fontSize: 11,
    letterSpacing: 1.1,
    color: "#6b7280",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#020617",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
    marginTop: 6,
  },
  bulletList: {
    marginTop: 4,
    marginBottom: 4,
    gap: 4,
  },
  bulletItem: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
});
