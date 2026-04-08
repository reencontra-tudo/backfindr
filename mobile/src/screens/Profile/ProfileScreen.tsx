import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../lib/theme';
import { useAuthStore } from '../../hooks/useAuth';

const MENU_ITEMS = [
  { icon: 'person-outline',         label: 'Editar perfil',         route: '/profile/edit' },
  { icon: 'notifications-outline',  label: 'Notificações',          route: '/notifications' },
  { icon: 'shield-checkmark-outline',label: 'Privacidade',          route: '/profile/privacy' },
  { icon: 'help-circle-outline',    label: 'Ajuda e suporte',       route: '/profile/help' },
  { icon: 'document-text-outline',  label: 'Termos de uso',         route: '/profile/terms' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '??';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? 'Usuário'}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        {/* Plan badge */}
        <View style={[styles.planBadge, user?.plan === 'pro' ? styles.planBadgePro : null]}>
          <Ionicons
            name={user?.plan === 'pro' ? 'star' : 'star-outline'}
            size={12}
            color={user?.plan === 'pro' ? '#eab308' : Colors.text.muted}
          />
          <Text style={[styles.planText, user?.plan === 'pro' ? styles.planTextPro : null]}>
            {user?.plan === 'pro' ? 'Plano Pro' : 'Plano Gratuito'}
          </Text>
        </View>
      </View>

      {/* Upgrade CTA */}
      {user?.plan !== 'pro' && (
        <TouchableOpacity style={styles.upgradeCta} activeOpacity={0.85}>
          <View style={styles.upgradeLeft}>
            <Ionicons name="flash" size={18} color="#eab308" />
            <View>
              <Text style={styles.upgradeTitle}>Upgrade para Pro</Text>
              <Text style={styles.upgradeSubtitle}>Objetos ilimitados · Alertas em tempo real</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#eab308" />
        </TouchableOpacity>
      )}

      {/* Menu */}
      <View style={styles.menuCard}>
        {MENU_ITEMS.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuItem, i < MENU_ITEMS.length - 1 ? styles.menuItemBorder : null]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={Colors.brand[400]} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Seu histórico</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>Objetos{'\n'}registrados</Text>
          </View>
          <View style={[styles.statItem, styles.statBorder]}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>—</Text>
            <Text style={styles.statLabel}>Recuperados</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.brand[400] }]}>—</Text>
            <Text style={styles.statLabel}>Pessoas{'\n'}ajudadas</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Backfindr v1.0.0 · Sprint 2</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex:1, backgroundColor:Colors.surface.DEFAULT },
  content:       { padding:Spacing.lg, paddingBottom:Spacing.xxl, gap:Spacing.md },
  avatarSection: { alignItems:'center', paddingVertical:Spacing.xl, gap:Spacing.sm },
  avatar:        { width:80, height:80, borderRadius:40, backgroundColor:Colors.brand[500], alignItems:'center', justifyContent:'center' },
  avatarText:    { ...Typography.display.lg, color:'#fff' },
  name:          { ...Typography.display.md, color:Colors.text.primary },
  email:         { ...Typography.body.md, color:Colors.text.muted },
  planBadge:     { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:10, paddingVertical:4, borderRadius:Radius.full, backgroundColor:Colors.surface.card, borderWidth:1, borderColor:Colors.surface.border },
  planBadgePro:  { borderColor:'#eab30840', backgroundColor:'#eab30810' },
  planText:      { ...Typography.body.sm, color:Colors.text.muted, fontWeight:'500' },
  planTextPro:   { color:'#eab308' },
  upgradeCta:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#eab30810', borderRadius:Radius.xl, borderWidth:1, borderColor:'#eab30830', padding:Spacing.md, gap:Spacing.md },
  upgradeLeft:   { flexDirection:'row', alignItems:'center', gap:Spacing.sm, flex:1 },
  upgradeTitle:  { ...Typography.body.md, color:'#eab308', fontWeight:'600' },
  upgradeSubtitle:{ ...Typography.body.sm, color:Colors.text.muted },
  menuCard:      { backgroundColor:Colors.surface.card, borderRadius:Radius.xl, borderWidth:1, borderColor:Colors.surface.border, overflow:'hidden' },
  menuItem:      { flexDirection:'row', alignItems:'center', gap:Spacing.md, padding:Spacing.md },
  menuItemBorder:{ borderBottomWidth:1, borderColor:Colors.surface.border },
  menuIcon:      { width:36, height:36, borderRadius:Radius.sm, backgroundColor:Colors.brand[500]+'15', alignItems:'center', justifyContent:'center' },
  menuLabel:     { ...Typography.body.md, color:Colors.text.primary, flex:1 },
  statsCard:     { backgroundColor:Colors.surface.card, borderRadius:Radius.xl, borderWidth:1, borderColor:Colors.surface.border, padding:Spacing.lg, gap:Spacing.md },
  statsTitle:    { ...Typography.display.sm, color:Colors.text.primary },
  statsRow:      { flexDirection:'row' },
  statItem:      { flex:1, alignItems:'center', gap:4 },
  statBorder:    { borderLeftWidth:1, borderRightWidth:1, borderColor:Colors.surface.border },
  statValue:     { ...Typography.display.md, color:Colors.text.primary },
  statLabel:     { ...Typography.body.sm, color:Colors.text.muted, textAlign:'center' },
  logoutBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:Spacing.sm, padding:Spacing.md, borderRadius:Radius.xl, borderWidth:1, borderColor:'#ef444430', backgroundColor:'#ef444410' },
  logoutText:    { ...Typography.body.md, color:'#ef4444', fontWeight:'600' },
  version:       { ...Typography.body.sm, color:Colors.surface.muted, textAlign:'center' },
});
