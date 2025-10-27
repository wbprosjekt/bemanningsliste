import { StyleSheet } from '@react-pdf/renderer';

export const colors = {
  primary: '#111827',
  secondary: '#2563eb',
  muted: '#6b7280',
  border: '#e5e7eb',
  background: '#f9fafb',
};

export const baseStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: colors.primary,
  },
  subheading: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  mutedText: {
    fontSize: 10,
    color: colors.muted,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  text: {
    fontSize: 11,
    lineHeight: 1.4,
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  value: {
    fontSize: 11,
    marginBottom: 8,
  },
  badge: {
    fontSize: 9,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    color: '#fff',
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    color: colors.muted,
    textAlign: 'center',
  },
});

export const tableStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  cell: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  cellSmall: {
    width: 50,
    padding: 6,
    fontSize: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
    textAlign: 'right',
  },
  headerText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});

export const statusColors: Record<string, string> = {
  apen: '#f97316',
  under_arbeid: '#2563eb',
  lukket: '#16a34a',
  aktiv: '#2563eb',
  signert: '#16a34a',
};
