import { Page, Text, View } from '@react-pdf/renderer';
import { baseStyles, colors } from './ReportStyles';
import { BefaringReportData } from './types';

interface ExecutiveSummaryProps {
  data: BefaringReportData;
}

export function ExecutiveSummary({ data }: ExecutiveSummaryProps) {
  const { stats } = data;

  const summaryItems = [
    { label: data.type === 'standard' ? 'Totale oppgaver' : 'Totale punkter', value: stats.totalItems },
    { label: 'Åpne', value: stats.openCount },
    { label: 'Under arbeid', value: stats.inProgressCount },
    { label: 'Lukket', value: stats.closedCount },
    { label: 'Kritiske funn', value: stats.criticalCount },
  ];

  return (
    <Page size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>Executive Summary</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {summaryItems.map((item) => (
          <View
            key={item.label}
            style={{
              width: '48%',
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 6,
            }}
          >
            <Text style={baseStyles.label}>{item.label}</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{item.value}</Text>
          </View>
        ))}
      </View>

      {stats.criticalCount > 0 && (
        <View
          style={{
            marginTop: 24,
            padding: 12,
            borderWidth: 1,
            borderColor: '#f87171',
            backgroundColor: '#fef2f2',
            borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#b91c1c', marginBottom: 4 }}>
            Kritiske funn må følges opp
          </Text>
          <Text style={{ fontSize: 10, color: '#991b1b' }}>
            Rapporten inneholder {stats.criticalCount} kritiske elementer som krever ekstra oppfølging.
          </Text>
        </View>
      )}
    </Page>
  );
}
