import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../lib/theme';
import { objectsApi, parseApiError } from '../../lib/api';
import { RegisteredObject } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORY_EMOJI: Record<string, string> = {
  phone:'📱', wallet:'👛', keys:'🔑', bag:'🎒', pet:'🐾',
  bike:'🚲', document:'📄', jewelry:'💍', electronics:'💻', clothing:'👕', other:'📦',
};

const STATUS_COLOR: Record<string, string> = {
  lost: '#ef4444', found: Colors.brand[500], returned: '#22c55e', stolen: '#f97316',
};
const STATUS_LABEL: Record<string, string> = {
  lost:'Perdido', found:'Achado', returned:'Recuperado', stolen:'Roubado',
};

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'lost', label: 'Perdidos' },
  { value: 'found', label: 'Achados' },
  { value: 'returned', label: 'Recuperados' },
];

export default function ObjectsScreen() {
  const router = useRouter();
  const [objects, setObjects] = useState<RegisteredObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await objectsApi.list({ status: statusFilter || undefined, size: 50 });
      setObjects(data?.items ?? []);
    } catch (err) {
      console.error(parseApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = objects.filter((o) =>
    search ? o.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  const renderItem = ({ item }: { item: RegisteredObject }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push(`/objects/${item.id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.itemEmoji}>
        <Text style={{ fontSize: 24 }}>{CATEGORY_EMOJI[item.category] ?? '📦'}</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
        <Text style={styles.itemTime}>
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
        <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
          {STATUS_LABEL[item.status]}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.text.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar objetos..."
          placeholderTextColor={Colors.text.muted}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, statusFilter === f.value ? styles.filterBtnActive : null]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.filterText, statusFilter === f.value ? styles.filterTextActive : null]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.brand[500]} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.brand[500]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyTitle}>Nenhum objeto{statusFilter ? ' com este filtro' : ''}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/objects/new')}>
                <Text style={styles.emptyBtnText}>Registrar objeto</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/objects/new')}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface.DEFAULT },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface.card, borderBottomWidth: 1, borderColor: Colors.surface.border, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  searchIcon:{ marginRight: Spacing.sm },
  searchInput:{ flex: 1, color: Colors.text.primary, fontSize: 14, paddingVertical: Spacing.xs },
  filtersRow:{ flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.xs, backgroundColor: Colors.surface.card, borderBottomWidth: 1, borderColor: Colors.surface.border },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surface.DEFAULT, borderWidth: 1, borderColor: Colors.surface.border },
  filterBtnActive:{ backgroundColor: Colors.brand[500] + '20', borderColor: Colors.brand[500] + '60' },
  filterText:{ fontSize: 12, color: Colors.text.muted },
  filterTextActive:{ color: Colors.brand[400], fontWeight: '600' },
  list:      { padding: Spacing.lg, gap: Spacing.xs, paddingBottom: 100 },
  item:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface.card, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.surface.border },
  itemEmoji: { width: 48, height: 48, backgroundColor: Colors.surface.DEFAULT, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  itemInfo:  { flex: 1 },
  itemTitle: { ...Typography.body.md, color: Colors.text.primary, fontWeight: '500' },
  itemDesc:  { ...Typography.body.sm, color: Colors.text.muted, marginTop: 2 },
  itemTime:  { ...Typography.body.sm, color: Colors.surface.muted, marginTop: 2 },
  badge:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  empty:     { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyEmoji:{ fontSize: 48 },
  emptyTitle:{ ...Typography.display.sm, color: Colors.text.secondary },
  emptyBtn:  { backgroundColor: Colors.brand[500], borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2 },
  emptyBtnText:{ ...Typography.body.md, color: '#fff', fontWeight: '600' },
  fab:       { position: 'absolute', right: Spacing.lg, bottom: Spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.brand[500], alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: Colors.brand[500], shadowOffset:{width:0,height:4}, shadowOpacity:0.4, shadowRadius:8 },
});
