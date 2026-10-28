import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';

const palette = {
  white: '#FFFFFF',
  text: '#172033',
  subtle: '#6b7280',
  shadow: 'rgba(15, 23, 42, 0.06)',
  primary: '#5b4bff',
  border: '#edf2ff',
};

const FormItem = ({ title, responses, onPress }: { title: string; responses: number; onPress: () => void }) => (
  <TouchableOpacity style={styles.itemContainer} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.itemIcon}>
      <Feather name="file-text" size={20} color={palette.primary} />
    </View>
    <View style={styles.itemContent}>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.itemSubtitle}>{responses} responses</Text>
    </View>
    <View style={styles.itemTrailing}>
      <Feather name="chevron-right" size={20} color={palette.subtle} />
    </View>
  </TouchableOpacity>
);

export const RecentFormList = ({ forms, navigation }: { forms: Array<{ label: string; value: number; id?: string }>; navigation: any }) => {
  const renderItem = ({ item }: { item: { label: string; value: number; id?: string } }) => (
    <FormItem
      title={item.label}
      responses={item.value}
      onPress={() => {
        if (item.id) {
          navigation.navigate('FormDetail', { formId: item.id });
        } else {
          // Fallback: show an alert that details are unavailable
          Alert.alert('Unable to open form', 'Form id not available for this item.');
        }
      }}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Top Forms</Text>
          <Text style={styles.subtitle}>Most engaging experiences right now</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Popular</Text>
        </View>
      </View>
      {forms.length > 0 ? (
        <FlatList
          data={forms}
          renderItem={renderItem}
          keyExtractor={(item) => item.id ?? `${item.label}-${item.value}`}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No high-traffic forms yet.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    fontSize: 12,
    color: palette.subtle,
    marginTop: 2,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  itemIcon: {
    backgroundColor: 'rgba(91, 75, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  itemSubtitle: {
    fontSize: 13,
    color: palette.subtle,
    marginTop: 2,
  },
  itemTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: palette.subtle,
  },
});
