import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../lib/theme';
import { objectsApi, matchesApi, parseApiError } from '../../lib/api';
import { RegisteredObject, Match } from '../../types';
import { useAuthStore } from '../../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};

const STATUS_COLOR: Record<string, string> = {
  lost: '#ef4444', found: Colors.brand[500], returned: '#22c55e', stolen: '#f97316',
};

const STATUS_LABEL: Record<string, string> = {
  lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado',
};

function StatCard({ icon, label, value, color }: {
  icon: string; label: string; value: number | string; color: string;
}) {
  return (
    <View style={[styles.statCard]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [objects, setObjects] = useState<RegisteredObject[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [objRes, matchRes] = await Promise.all([
        objectsApi.list({ size: 5 }),
        matchesApi.list(),
      ]);
      setObjects(objRes.data?.items ?? []);
      setMatches(matchRes.data?.items ?? []);
    } catch (err) {
      console.error(parseApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.name?.split(' ')[0] ?? '';

  const pending = matches.filter((m) => m.status === 'pending').length;
  const lost = objects.filter((o) => o.status === 'lost').length;
  const returned = objects.filter((o) => o.status === 'returned').length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand[500]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}{firstName ? `, ${firstName}` : ''} 👋</Text>
          <Text style={styles.greetingSub}>Aqui está um resumo dos seus objetos.</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/objects/new')}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard icon="cube-outline" label="Total" value={loading ? '—' : objects.length} color={Colors.brand[500]} />
        <StatCard icon="alert-circle-outline" label="Perdidos" value={loading ? '—' : lost} color="#ef4444" />
        <StatCard icon="checkmark-circle-outline" label="Recuperados" value={loading ? '—' : returned} color="#22c55e" />
        <StatCard icon="flash-outline" label="Matches" value={loading ? '—' : pending} color="#eab308" />
      </View>

      {/* Matches CTA */}
      {pending > 0 && (
        <TouchableOpacity
          style={styles.matchesCta}
          onPress={() => router.push('/(tabs)/matches')}
          activeOpacity={0.85}
        >
          <View style={styles.matchesCtaLeft}>
            <Ionicons name="flash" size={18} color={Colors.brand[400]} />
            <Text style={styles.matchesCtaText}>
              {pending} match{pending > 1 ? 'es' : ''} pendente{pending > 1 ? 's' : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.brand[400]} />
        </TouchableOpacity>
      )}

      {/* Recent objects */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Objetos recentes</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/objects')}>
            <Text style={styles.seeAll}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.brand[500]} style={{ marginTop: Spacing.lg }} />
        ) : objects.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => router.push('/objects/new')}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>Nenhum objeto ainda</Text>
            <Text style={styles.emptySubtitle}>Toque para registrar seu primeiro objeto</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.objectList}>
            {objects.map((obj) => (
              <TouchableOpacity
                key={obj.id}
                style={styles.objectRow}
                onPress={() => router.push(`/objects/${obj.id}`)}
                activeOpacity={0.75}
              >
                <View style={styles.objectEmoji}>
                  <Text style={{ fontSize: 22 }}>{CATEGORY_EMOJI[obj.category] ?? '📦'}</Text>
                </View>
                <View style={styles.objectInfo}>
                  <Text style={styles.objectTitle} numberOfLines={1}>{obj.title}</Text>
                  <Text style={styles.objectTime}>
                    {formatDistanceToNow(new Date(obj.created_at), { addSuffix: true, locale: ptBR })}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[obj.status] + '20' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[obj.status] }]}>
                    {STATUS_LABEL[obj.status]}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface.DEFAULT },
  content:   { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, paddingTop: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  greeting:    { ...Typography.display.md, color: Colors.text.primary },
  greetingSub: { ...Typography.body.md, color: Colors.text.secondary, marginTop: 2 },
  addBtn: {
    width: 44, height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.brand[500],
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.surface.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statIcon: {
    width: 36, height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: { ...Typography.display.sm, color: Colors.text.primary },
  statLabel: { ...Typography.body.sm, color: Colors.text.muted, textAlign: 'center' },
  matchesCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.brand[500] + '15',
    borderWidth: 1,
    borderColor: Colors.brand[500] + '40',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  matchesCtaLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  matchesCtaText:  { ...Typography.body.md, color: Colors.brand[400], fontWeight: '600' },
  section:         { marginTop: Spacing.md },
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle:    { ...Typography.display.sm, color: Colors.text.primary },
  seeAll:          { ...Typography.body.sm, color: Colors.brand[400] },
  emptyCard: {
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.surface.border,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyEmoji:    { fontSize: 40 },
  emptyTitle:    { ...Typography.display.sm, color: Colors.text.primary },
  emptySubtitle: { ...Typography.body.md, color: Colors.text.secondary, textAlign: 'center' },
  objectList:  { gap: Spacing.xs },
  objectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.surface.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  objectEmoji: {
    width: 44, height: 44,
    backgroundColor: Colors.surface.DEFAULT,
    borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  objectInfo:  { flex: 1 },
  objectTitle: { ...Typography.body.md, color: Colors.text.primary, fontWeight: '500' },
  objectTime:  { ...Typography.body.sm, color: Colors.text.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusText:  { fontSize: 11, fontWeight: '600' },
});
