import { Page, Text } from '@react-pdf/renderer';
import { BefaringspunktListe } from './BefaringspunktListe';
import { BildgalleriPage } from './BildgalleriPage';
import { ReportPunkt, ReportImage } from './types';
import { baseStyles } from './ReportStyles';

interface FriBefaringReportLayoutProps {
  punkter?: ReportPunkt[];
}

export function FriBefaringReportLayout({ punkter = [] }: FriBefaringReportLayoutProps) {
  if (punkter.length === 0) {
    return (
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.sectionTitle}>Befaringspunkter</Text>
        <Text style={baseStyles.text}>Ingen punkter registrert.</Text>
      </Page>
    );
  }

  const allImages: ReportImage[] = punkter.flatMap((punkt) => punkt.images ?? []);

  return (
    <>
      <BefaringspunktListe punkter={punkter} />
      {allImages.length > 0 && <BildgalleriPage title="Bilder fra befaringspunkter" images={allImages} />}
    </>
  );
}
