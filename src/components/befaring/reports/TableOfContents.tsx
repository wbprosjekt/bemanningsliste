import { Page, Text, View } from '@react-pdf/renderer';
import { baseStyles } from './ReportStyles';
import { BefaringReportData } from './types';

interface TableOfContentsProps {
  data: BefaringReportData;
}

export function TableOfContents({ data }: TableOfContentsProps) {
  const sections = [
    { title: 'Forside', page: 1 },
    { title: 'Innholdsfortegnelse & Sammendrag', page: 2 },
    { title: data.type === 'standard' ? 'Plantegninger og oppgaver' : 'Befaringspunkter', page: 3 },
    { title: 'Signaturer', page: 4 },
  ];

  return (
    <Page size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>Innholdsfortegnelse</Text>
      {sections.map((section) => (
        <View key={section.title} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={baseStyles.text}>{section.title}</Text>
          <Text style={baseStyles.text}>{section.page}</Text>
        </View>
      ))}

      <View style={{ marginTop: 40 }}>
        <Text style={baseStyles.sectionTitle}>Rapportinformasjon</Text>
        <Text style={baseStyles.text}>Type: {data.type === 'standard' ? 'Standard befaring' : 'Fri befaring'}</Text>
        <Text style={baseStyles.text}>Status: {data.befaring.status ?? 'Ukjent'}</Text>
      </View>
    </Page>
  );
}
