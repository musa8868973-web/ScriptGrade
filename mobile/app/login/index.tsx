/**
 * Sign-in screen — POST /api/v1/auth/login via the secure auth hook.
 *
 * On success the JWT + user profile are persisted to SecureStore by the
 * hook and the root layout's auth gate routes to Home automatically.
 * Errors render the backend's standardized envelope message (never raw
 * stack traces).
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertCircle, Eye, EyeOff, GraduationCap, Lock, Mail } from 'lucide-react-native';

import { useAuth } from '../../hooks/useAuth';
import { colors, radius, spacing } from '../../lib/theme';

export default function LoginScreen(): React.JSX.Element {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) {
      setErrorMessage(
        result.error?.message ?? 'Sign-in failed. Please try again.',
      );
    }
    // Success: the root layout auth gate redirects to Home.
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <GraduationCap size={30} color={colors.text} />
          </View>
          <Text style={styles.brandTitle}>ScriptGrade</Text>
          <Text style={styles.brandSubtitle}>
            AI-powered exam evaluation · mobile scanner
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Teacher sign-in</Text>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputWrap}>
            <Mail size={17} color={colors.textDim} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
          </View>

          <View style={styles.inputWrap}>
            <Lock size={17} color={colors.textDim} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textDim}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              onSubmitEditing={() => {
                void handleSubmit();
              }}
              returnKeyType="go"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((value) => !value)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={8}
            >
              {showPassword ? (
                <EyeOff size={17} color={colors.textDim} />
              ) : (
                <Eye size={17} color={colors.textDim} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={!canSubmit}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.submitLabel}>Sign in securely</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footnote}>
            Credentials are verified by the ScriptGrade gateway; the session
            token is stored in the device secure enclave (Keychain /
            Keystore), never in plain storage.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing(6),
    gap: spacing(8),
  },
  brandRow: {
    alignItems: 'center',
    gap: spacing(2),
  },
  brandBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: colors.textDim,
    fontSize: 13,
  },
  form: {
    gap: spacing(3),
  },
  formTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing(1),
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: spacing(3.5),
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    marginTop: spacing(1),
  },
  submitDisabled: {
    opacity: 0.55,
  },
  submitLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  footnote: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: spacing(2),
  },
});
