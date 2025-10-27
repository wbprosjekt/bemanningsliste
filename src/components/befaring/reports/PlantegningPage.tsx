import { Page, Text, View, Image } from '@react-pdf/renderer';
import { baseStyles, colors, statusColors, tableStyles } from './ReportStyles';
import { ReportPlantegning } from './types';

interface PlantegningPageProps {
  plantegning: ReportPlantegning;
  index: number;
}

export function PlantegningPage({ plantegning, index }: PlantegningPageProps) {
  const oppgaver = plantegning.oppgaver ?? [];

  const clampPercent = (value?: number | null) => {
    if (value === null || value === undefined) return null;
    if (Number.isNaN(value)) return null;
    return Math.max(0, Math.min(100, value));
  };
  const statusLabel = (status?: string | null) => {
    switch (status) {
      case 'apen':
        return 'Åpen';
      case 'under_arbeid':
        return 'Under arbeid';
      case 'lukket':
        return 'Lukket';
      default:
        return 'Ukjent';
    }
  };

  return (
    <Page key={plantegning.id} size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>
        Plantegning {index + 1}: {plantegning.title || 'Uten tittel'}
      </Text>

      {plantegning.image_url && (
        <View
          style={{
            borderRadius: 8,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 12,
            height: 220,
            position: 'relative',
          }}
        >
          <Image
            src={plantegning.image_url as string}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {oppgaver.map((oppgave) => {
              const x = clampPercent(oppgave.x_position);
              const y = clampPercent(oppgave.y_position);

              if (x === null || y === null) {
                return null;
              }

              return (
                <View
                  key={`marker-${oppgave.id}`}
                  style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: statusColors[oppgave.status ?? 'apen'] || colors.secondary,
                    borderWidth: 2,
                    borderColor: '#fff',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginLeft: -9,
                    marginTop: -9,
                  }}
                >
                  <Text style={{ fontSize: 8, color: '#fff', fontWeight: 'bold' }}>
                    {oppgave.oppgave_nummer ?? '?'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {oppgaver.length === 0 ? (
        <Text style={baseStyles.text}>Ingen oppgaver registrert på denne plantegningen.</Text>
      ) : (
        <>
          <View style={tableStyles.headerRow}>
            <Text style={[tableStyles.cellSmall, tableStyles.headerText]}>#</Text>
            <Text style={[tableStyles.cell, tableStyles.headerText]}>Oppgave</Text>
            <Text style={[tableStyles.cell, tableStyles.headerText]}>Fag</Text>
            <Text style={[tableStyles.cell, tableStyles.headerText]}>Status</Text>
          </View>
          {oppgaver.map((oppgave) => (
            <View key={oppgave.id} style={tableStyles.row}>
              <Text style={tableStyles.cellSmall}>{oppgave.oppgave_nummer ?? '—'}</Text>
              <View style={[tableStyles.cell, { flexDirection: 'column' }]}>
                <Text style={{ fontWeight: 'bold' }}>{oppgave.title || 'Uten tittel'}</Text>
                {oppgave.description && (
                  <Text style={baseStyles.mutedText}>{oppgave.description}</Text>
                )}
                {oppgave.images && oppgave.images.length > 0 && (
                  <Text style={{ fontSize: 9, fontStyle: 'italic' }}>
                    {oppgave.images.length} bilde(r)
                  </Text>
                )}
              </View>
              <Text style={tableStyles.cell}>{oppgave.fag || '—'}</Text>
                <Text
                  style={[
                    tableStyles.cell,
                  {
                    color: '#fff',
                    backgroundColor: statusColors[oppgave.status ?? 'apen'] || colors.secondary,
                    textAlign: 'center',
                    borderBottomWidth: 0,
                    margin: 2,
                    borderRadius: 4,
                  },
                  ]}
                >
                {statusLabel(oppgave.status)}
              </Text>
            </View>
          ))}
        </>
      )}
    </Page>
  );
}
