import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Share, ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../lib/theme';
import { objectsApi, parseApiError } from '../../lib/api';
import { RegisteredObject } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORY_EMOJI: Record<string, string> = {
  phone:'📱', wallet:'👛', keys:'🔑', bag:'🎒', pet:'🐾',
  bike:'🚲', document:'📄', jewelry:'💍', electronics:'💻', clothing:'👕', other:'📦',
};

const STATUS_CONFIG: Record<string, { label:string; color:string; icon:string }> = {
  lost:     { label:'Perdido',    color:'#ef4444', icon:'alert-circle-outline' },
  found:    { label:'Achado',     color:Colors.brand[500], icon:'cube-outline' },
  returned: { label:'Recuperado', color:'#22c55e', icon:'checkmark-circle-outline' },
  stolen:   { label:'Roubado',    color:'#f97316', icon:'warning-outline' },
};

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? 'https://backfindr.com.br';

export default function ObjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [obj, setObj] = useState<RegisteredObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    objectsApi.get(id)
      .then(({ data }) => setObj(data))
      .catch((err) => {
        Alert.alert('Erro', parseApiError(err));
        router.back();
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    if (obj?.status === status) return;
    setUpdating(true);
    try {
      await objectsApi.update(id, { status });
      setObj((prev) => prev ? { ...prev, status: status as RegisteredObject['status'] } : prev);
    } catch (err) {
      Alert.alert('Erro', parseApiError(err));
    } finally {
      setUpdating(false);
    }
  };

  const handleShare = () => {
    if (!obj) return;
    Share.share({
      title: obj.title,
      message: `Encontrei este objeto registrado no Backfindr: ${APP_URL}/scan/${obj.unique_code}`,
      url: `${APP_URL}/scan/${obj.unique_code}`,
    });
  };

  const handleDelete = () => {
    Alert.alert('Excluir objeto', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await objectsApi.delete(id);
            router.back();
          } catch (err) {
            Alert.alert('Erro', parseApiError(err));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.brand[500]} size="large" />
      </View>
    );
  }

  if (!obj) return null;

  const statusCfg = STATUS_CONFIG[obj.status] ?? STATUS_CONFIG.lost;
  const scanUrl = `${APP_URL}/scan/${obj.unique_code}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(scanUrl)}&color=14b8a6&bgcolor=0f172a&margin=8`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.emoji}>{CATEGORY_EMOJI[obj.category] ?? '📦'}</Text>
        <Text style={styles.title}>{obj.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '20' }]}>
          <Ionicons name={statusCfg.icon as keyof typeof Ionicons.glyphMap} size={14} color={statusCfg.color} />
          <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={Colors.text.secondary} />
          <Text style={styles.actionText}>Compartilhar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
          <Text style={[styles.actionText, { color: '#ef4444' }]}>Excluir</Text>
        </TouchableOpacity>
      </View>

      {/* QR Code */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>QR Code do objeto</Text>
        <View style={styles.qrContainer}>
          <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
        </View>
        <View style={styles.codeRow}>
          <Text style={styles.code}>{obj.unique_code}</Text>
        </View>
        <Text style={styles.qrHint}>
          Cole este QR Code no objeto. Qualquer pessoa que escanear iniciará a devolução.
        </Text>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={16} color={Colors.brand[400]} />
          <Text style={styles.shareBtnText}>Compartilhar link de scan</Text>
        </TouchableOpacity>
      </View>

      {/* Description */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Descrição</Text>
        <Text style={styles.desc}>{obj.description}</Text>
      </View>

      {/* Pet details */}
      {obj.category === 'pet' && (obj.pet_breed || obj.pet_color || obj.pet_microchip) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🐾 Informações do Pet</Text>
          <View style={styles.metaGrid}>
            {obj.pet_species && <MetaItem label="Espécie" value={obj.pet_species} />}
            {obj.pet_breed && <MetaItem label="Raça" value={obj.pet_breed} />}
            {obj.pet_color && <MetaItem label="Cor" value={obj.pet_color} />}
            {obj.pet_microchip && <MetaItem label="Microchip" value={obj.pet_microchip} mono />}
          </View>
        </View>
      )}

      {/* Meta */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informações</Text>
        <MetaItem label="Registrado em" value={format(new Date(obj.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })} />
        {obj.location?.address && <MetaItem label="Local" value={obj.location.address} />}
      </View>

      {/* Update status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Atualizar status</Text>
        {(['lost', 'found', 'returned'] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const active = obj.status === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.statusOption, active ? { backgroundColor: cfg.color + '15', borderColor: cfg.color + '50' } : null]}
              onPress={() => updateStatus(s)}
              disabled={updating || active}
            >
              <Ionicons name={cfg.icon as keyof typeof Ionicons.glyphMap} size={18} color={active ? cfg.color : Colors.text.muted} />
              <Text style={[styles.statusOptionText, { color: active ? cfg.color : Colors.text.secondary }]}>{cfg.label}</Text>
              {active && <Ionicons name="checkmark" size={16} color={cfg.color} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function MetaItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={metaStyles.row}>
      <Text style={metaStyles.label}>{label}</Text>
      <Text style={[metaStyles.value, mono ? metaStyles.mono : null]}>{value}</Text>
    </View>
  );
}

const metaStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: Colors.surface.border },
  label: { ...Typography.body.sm, color: Colors.text.muted },
  value: { ...Typography.body.sm, color: Colors.text.primary, flex: 1, textAlign: 'right' },
  mono:  { fontFamily: 'Courier New', fontSize: 12 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface.DEFAULT },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface.DEFAULT },
  header:    { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  emoji:     { fontSize: 56 },
  title:     { ...Typography.display.lg, color: Colors.text.primary, textAlign: 'center' },
  statusBadge:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:6, borderRadius:Radius.full },
  statusText: { fontSize:13, fontWeight:'600' },
  actions:   { flexDirection:'row', gap:Spacing.sm },
  actionBtn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, backgroundColor:Colors.surface.card, borderRadius:Radius.md, paddingVertical:12, borderWidth:1, borderColor:Colors.surface.border },
  actionText:{ ...Typography.body.sm, color:Colors.text.secondary, fontWeight:'500' },
  card:      { backgroundColor:Colors.surface.card, borderRadius:Radius.xl, borderWidth:1, borderColor:Colors.surface.border, padding:Spacing.lg, gap:Spacing.sm },
  cardTitle: { ...Typography.display.sm, color:Colors.text.primary, marginBottom:4 },
  qrContainer:{ alignItems:'center', padding:Spacing.md, backgroundColor:Colors.surface.DEFAULT, borderRadius:Radius.lg },
  qrImage:   { width:200, height:200, borderRadius:Radius.md },
  codeRow:   { backgroundColor:Colors.surface.DEFAULT, borderRadius:Radius.md, padding:Spacing.sm, alignItems:'center', borderWidth:1, borderColor:Colors.surface.border },
  code:      { fontFamily:'Courier New', fontSize:16, color:Colors.brand[400], letterSpacing:2 },
  qrHint:    { ...Typography.body.sm, color:Colors.text.muted, textAlign:'center', lineHeight:18 },
  shareBtn:  { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:10 },
  shareBtnText:{ ...Typography.body.sm, color:Colors.brand[400], fontWeight:'500' },
  desc:      { ...Typography.body.md, color:Colors.text.secondary, lineHeight:22 },
  metaGrid:  { gap:0 },
  statusOption:{ flexDirection:'row', alignItems:'center', gap:Spacing.sm, padding:Spacing.md, borderRadius:Radius.md, borderWidth:1, borderColor:'transparent', marginBottom:4 },
  statusOptionText:{ ...Typography.body.md, fontWeight:'500' },
});
