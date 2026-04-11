import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Typography } from '../../lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.includes('@')) e.email = 'E-mail inválido';
    if (password.length < 6) e.password = 'Mínimo 6 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Erro', 'E-mail ou senha incorretos.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="location" size={24} color="#fff" />
          </View>
          <Text style={styles.logoText}>Backfindr</Text>
        </View>

        <Text style={styles.title}>Entrar na conta</Text>
        <Text style={styles.subtitle}>
          Não tem conta?{' '}
          <Text
            style={styles.link}
            onPress={() => router.push('/auth/register')}
          >
            Criar grátis
          </Text>
        </Text>

        {/* Card */}
        <View style={styles.card}>
          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={Colors.text.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex, errors.password ? styles.inputError : null]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.text.muted}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPass(!showPass)}
              >
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Colors.text.muted}
                />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}
            <TouchableOpacity style={styles.forgotBtn} onPress={() => {}}>
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, isLoading ? styles.btnDisabled : null]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.btnText}>Entrar</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.DEFAULT,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: 80,
    paddingBottom: Spacing.xxl,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.xl,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    ...Typography.display.sm,
    color: Colors.text.primary,
  },
  title: {
    ...Typography.display.lg,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body.md,
    color: Colors.text.secondary,
    marginBottom: Spacing.xl,
  },
  link: {
    color: Colors.brand[400],
  },
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surface.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  field: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.body.sm,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.surface.DEFAULT,
    borderWidth: 1,
    borderColor: Colors.surface.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    color: Colors.text.primary,
    fontSize: 14,
  },
  inputFlex: {
    flex: 1,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  eyeBtn: {
    padding: Spacing.sm,
  },
  error: {
    ...Typography.body.sm,
    color: '#f87171',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  forgotText: {
    ...Typography.body.sm,
    color: Colors.text.muted,
  },
  btn: {
    backgroundColor: Colors.brand[500],
    borderRadius: Radius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    ...Typography.body.lg,
    color: '#fff',
    fontWeight: '600',
  },
});
