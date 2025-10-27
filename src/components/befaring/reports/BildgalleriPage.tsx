import { Page, Text, View, Image } from '@react-pdf/renderer';
import { baseStyles, colors } from './ReportStyles';
import { ReportImage } from './types';

interface BildgalleriPageProps {
  title: string;
  images: ReportImage[];
}

export function BildgalleriPage({ title, images }: BildgalleriPageProps) {
  return (
    <Page size="A4" style={baseStyles.page}>
      <Text style={baseStyles.sectionTitle}>{title}</Text>

      {images.length === 0 && <Text style={baseStyles.text}>Ingen bilder tilgjengelig.</Text>}

      {images.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {images.map((image) => (
            <View
              key={image.id}
              style={{
                width: '48%',
                marginBottom: 12,
                borderRadius: 8,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Image src={image.image_url} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
              <View style={{ padding: 6 }}>
                <Text style={{ fontSize: 9, color: colors.muted }}>
                  {image.image_type || 'Bilde'} • {image.id.slice(0, 6)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}
