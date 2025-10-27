import { Page, Text, View, Image } from '@react-pdf/renderer';
import { baseStyles, colors, statusColors } from './ReportStyles';
import { ReportPunkt } from './types';

interface BefaringspunktListeProps {
  punkter: ReportPunkt[];
}

export function BefaringspunktListe({ punkter }: BefaringspunktListeProps) {
  return (
    <Page size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>Befaringspunkter</Text>

      {punkter.length === 0 && (
        <Text style={baseStyles.text}>Ingen befaringspunkter registrert.</Text>
      )}

      {punkter.map((punkt) => (
          <View
            key={punkt.id}
            style={{
              marginBottom: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 6,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <View>
                <Text style={{ fontWeight: 'bold' }}>
                  Punkt {punkt.punkt_nummer ?? '—'}: {punkt.title || 'Uten tittel'}
                </Text>
                <Text style={baseStyles.mutedText}>
                  Opprettet:{' '}
                  {punkt.created_at
                    ? new Date(punkt.created_at).toLocaleDateString('nb-NO')
                    : 'Ukjent'}
                </Text>
              </View>
              <Text
                style={{
                  ...baseStyles.badge,
                  backgroundColor: statusColors[punkt.status ?? 'aktiv'] || colors.secondary,
                }}
              >
                {(punkt.status || 'aktiv').replace('_', ' ')}
              </Text>
            </View>
            {punkt.description && <Text style={baseStyles.text}>{punkt.description}</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={baseStyles.text}>Fag: {punkt.fag || '—'}</Text>
              <Text style={baseStyles.text}>Prioritet: {punkt.prioritet || '—'}</Text>
            </View>
            {punkt.images && punkt.images.length > 0 && (
              <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                {punkt.images.slice(0, 2).map((image) => (
                  <Image
                    key={image.id}
                    src={image.image_url}
                    style={{ width: 80, height: 60, borderRadius: 4, objectFit: 'cover' }}
                  />
                ))}
                {punkt.images.length > 2 && (
                  <Text style={{ fontSize: 9, alignSelf: 'center' }}>
                    +{punkt.images.length - 2} flere
                  </Text>
                )}
              </View>
            )}
          </View>
      ))}
    </Page>
  );
}
