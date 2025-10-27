import { Page, Text, View } from '@react-pdf/renderer';
import { baseStyles, colors } from './ReportStyles';
import { ReportBefaring } from './types';

interface SignaturPageProps {
  befaring: ReportBefaring;
  reportId: string;
}

export function SignaturPage({ befaring, reportId }: SignaturPageProps) {
  return (
    <Page size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>Signatur</Text>

      <View style={{ marginTop: 40, gap: 30 }}>
        {['Klient', 'Byggherre', 'Teknisk godkjenning'].map((role) => (
          <View key={role} style={{ marginBottom: 30 }}>
            <Text style={baseStyles.label}>{role}</Text>
            <View style={{ borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 20 }} />
          </View>
        ))}
      </View>

      <Text style={baseStyles.footer}>
        Rapport-ID: {reportId} • {befaring.title} • Generert {new Date().toLocaleDateString('nb-NO')}
      </Text>
    </Page>
  );
}
