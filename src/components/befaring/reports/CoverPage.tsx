import { Page, Text, View } from '@react-pdf/renderer';
import { baseStyles, colors } from './ReportStyles';
import { ReportBefaring } from './types';

interface CoverPageProps {
  befaring: ReportBefaring;
  reportId: string;
}

export function CoverPage({ befaring, reportId }: CoverPageProps) {
  return (
    <Page size="A4" style={{ ...baseStyles.page, justifyContent: 'space-between' }}>
      <View>
        <Text style={{ fontSize: 26, fontWeight: 'bold', marginBottom: 6 }}>FieldNote</Text>
        <Text style={{ fontSize: 10, color: colors.muted, marginBottom: 40 }}>BEFARINGSRAPPORT</Text>

        <View style={{ marginBottom: 20 }}>
          <Text style={baseStyles.label}>Rapport</Text>
          <Text style={{ ...baseStyles.sectionTitle, marginBottom: 4 }}>{befaring.title}</Text>
          <Text style={baseStyles.text}>
            {befaring.project_name ? befaring.project_name : befaring.befaring_type}
          </Text>
        </View>

        <View style={{ marginBottom: 14 }}>
          <Text style={baseStyles.label}>Dato</Text>
          <Text style={baseStyles.value}>{befaring.dateFormatted}</Text>
        </View>

        <View style={{ marginBottom: 14 }}>
          <Text style={baseStyles.label}>Sted</Text>
          <Text style={baseStyles.value}>
            {[befaring.adresse, befaring.postnummer, befaring.sted].filter(Boolean).join(', ') || 'Ikke angitt'}
          </Text>
        </View>

        <View style={{ marginBottom: 14 }}>
          <Text style={baseStyles.label}>Utført av</Text>
          <Text style={baseStyles.value}>{befaring.performedBy || 'FieldNote-teamet'}</Text>
        </View>
      </View>

      <Text style={baseStyles.footer}>
        Generert av FieldNote • Rapport-ID: {reportId} • www.fieldnote.no
      </Text>
    </Page>
  );
}
