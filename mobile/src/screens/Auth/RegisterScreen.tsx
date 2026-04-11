import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Typography } from '../../lib/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const strengthScore = [
    form.password.length >= 8,
    /[A-Z]/.test(form.password),
    /[0-9]/.test(form.password),
    /[^A-Za-z0-9]/.test(form.password),
  ].filter(Boolean).length;

  const STRENGTH_COLORS = ['#ef4444', '#eab308', '#14b8a6', '#22c55e'];

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.length < 2) e.name = 'Nome muito curto';
    if (!form.email.includes('@')) e.email = 'E-mail inválido';
    if (form.password.length < 8) e.password = 'Mínimo 8 caracteres';
    if (form.password !== form.confirm) e.confirm = 'Senhas não conferem';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    try {
      await register({ name: form.name, email: form.email, password: form.password, phone: form.phone || undefined });
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Erro', 'Não foi possível criar a conta. Verifique os dados.');
    }
  };

  const field = (key: keyof typeof form, label: string, opts: object = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, errors[key] ? styles.inputError : null]}
        value={form[key]}
        onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
        placeholderTextColor={Colors.text.muted}
        autoCapitalize="none"
        {...opts}
      />
      {errors[key] ? <Text style={styles.error}>{errors[key]}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text.secondary} />
        </TouchableOpacity>

        <Text style={styles.title}>Criar conta grátis</Text>
        <Text style={styles.subtitle}>
          Já tem conta?{' '}
          <Text style={styles.link} onPress={() => router.push('/auth/login')}>Entrar</Text>
        </Text>

        <View style={styles.card}>
          {field('name', 'Nome completo', { placeholder: 'João Silva', autoCapitalize: 'words' })}
          {field('email', 'E-mail', { placeholder: 'seu@email.com', keyboardType: 'email-address' })}
          {field('phone', 'Telefone (opcional)', { placeholder: '+55 11 99999-9999', keyboardType: 'phone-pad' })}

          {/* Password with strength */}
          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex, errors.password ? styles.inputError : null]}
                value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={Colors.text.muted}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.text.muted} />
              </TouchableOpacity>
            </View>
            {form.password.length > 0 && (
              <View style={styles.strengthRow}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: i < strengthScore ? STRENGTH_COLORS[strengthScore - 1] : Colors.surface.border },
                    ]}
                  />
                ))}
              </View>
            )}
            {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}
          </View>

          {field('confirm', 'Confirmar senha', { placeholder: '••••••••', secureTextEntry: true })}

          <TouchableOpacity
            style={[styles.btn, isLoading ? styles.btnDisabled : null]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <><Text style={styles.btnText}>Criar conta</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>
            }
          </TouchableOpacity>

          <Text style={styles.terms}>
            Ao criar conta, você concorda com os{' '}
            <Text style={styles.link}>Termos de Uso</Text> e{' '}
            <Text style={styles.link}>Política de Privacidade</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface.DEFAULT },
  scroll:    { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.xxl },
  back:      { marginBottom: Spacing.lg, alignSelf: 'flex-start', padding: Spacing.xs },
  title:     { ...Typography.display.lg, color: Colors.text.primary, marginBottom: Spacing.xs },
  subtitle:  { ...Typography.body.md, color: Colors.text.secondary, marginBottom: Spacing.xl },
  link:      { color: Colors.brand[400] },
  card:      { backgroundColor: Colors.surface.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.surface.border, padding: Spacing.lg, gap: Spacing.md },
  field:     { gap: Spacing.xs },
  label:     { ...Typography.body.sm, color: Colors.text.secondary, fontWeight: '500' },
  input:     { backgroundColor: Colors.surface.DEFAULT, borderWidth: 1, borderColor: Colors.surface.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 14, color: Colors.text.primary, fontSize: 14 },
  inputFlex: { flex: 1 },
  inputError:{ borderColor: '#ef4444' },
  inputRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  eyeBtn:    { padding: Spacing.sm },
  strengthRow:{ flexDirection: 'row', gap: 4, marginTop: 6 },
  strengthBar:{ flex: 1, height: 3, borderRadius: 99 },
  error:     { ...Typography.body.sm, color: '#f87171' },
  btn:       { backgroundColor: Colors.brand[500], borderRadius: Radius.md, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  btnDisabled:{ opacity: 0.6 },
  btnText:   { ...Typography.body.lg, color: '#fff', fontWeight: '600' },
  terms:     { ...Typography.body.sm, color: Colors.text.muted, textAlign: 'center' },
});
