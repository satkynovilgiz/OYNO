import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, TextField } from '@/components/ui';
import { supabase } from '@/services/supabase/client';
import { colors, spacing, typography } from '@/theme';

type AdminPushScreenProps = {
  onPressBack: () => void;
};

/** Real, server-driven send: admin_send_push_broadcast (SECURITY DEFINER,
 * see supabase/migrations/20260829000006_push_notifications.sql) queries
 * every registered device from push_tokens and calls Expo's push API via
 * pg_net - this client only triggers it and shows the recipient count it
 * reports back, it never touches device tokens or Expo's API directly. */
export function AdminPushScreen({ onPressBack }: AdminPushScreenProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSend() {
    setIsSending(true);
    setResult(null);
    const { data, error } = await supabase.rpc('admin_send_push_broadcast', { p_title: title, p_body: body });
    setIsSending(false);
    if (error) {
      setResult(`Error: ${error.message}`);
      return;
    }
    setResult(`Queued for ${data} device(s).`);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Back" onPress={onPressBack} />
        <Text style={styles.title}>Push broadcast</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.note}>
          Sends to every device currently registered in push_tokens. There's no scheduling or
          audience targeting yet - this is a one-shot broadcast to everyone.
        </Text>

        <TextField label="Title" value={title} onChangeText={setTitle} />
        <TextField label="Body" value={body} onChangeText={setBody} multiline numberOfLines={4} />

        {result && <Text style={styles.result}>{result}</Text>}

        <Button label="Send to all devices" onPress={handleSend} loading={isSending} disabled={!title.trim() || !body.trim()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  note: {
    ...typography.small,
    color: colors.textMuted,
  },
  result: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
