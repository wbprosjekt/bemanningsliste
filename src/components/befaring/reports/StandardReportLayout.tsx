import { Page, Text } from '@react-pdf/renderer';
import { PlantegningPage } from './PlantegningPage';
import { BildgalleriPage } from './BildgalleriPage';
import { ReportPlantegning, ReportImage } from './types';
import { baseStyles } from './ReportStyles';

interface StandardReportLayoutProps {
  plantegninger?: ReportPlantegning[];
}

export function StandardReportLayout({ plantegninger = [] }: StandardReportLayoutProps) {
  if (plantegninger.length === 0) {
    return (
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.sectionTitle}>Plantegninger og oppgaver</Text>
        <Text style={baseStyles.text}>Ingen plantegninger registrert for denne befaringen.</Text>
      </Page>
    );
  }

  const allImages: ReportImage[] = plantegninger.flatMap((plantegning) =>
    (plantegning.oppgaver ?? []).flatMap((oppgave) => oppgave.images ?? []),
  );

  return (
    <>
      {plantegninger.map((plantegning, index) => (
        <PlantegningPage key={plantegning.id} plantegning={plantegning} index={index} />
      ))}
      {allImages.length > 0 && <BildgalleriPage title="Bilder fra oppgaver" images={allImages} />}
    </>
  );
}
