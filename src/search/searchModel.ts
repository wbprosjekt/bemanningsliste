import { Building2, FileText, MapPin, Users } from "lucide-react";

export type SearchType = 'project' | 'befaring' | 'fri_befaring' | 'photo' | 'user';

export const TYPE_ICONS = {
  project: Building2,
  befaring: FileText,
  fri_befaring: MapPin,
  photo: FileText,
  user: Users,
} as const;

export const TYPE_LABELS: Record<SearchType, string> = {
  project: 'Prosjekt',
  befaring: 'Befaring',
  fri_befaring: 'Fri befaring',
  photo: 'Bilde',
  user: 'Bruker',
};

export const TYPE_COLORS: Record<SearchType, string> = {
  project: 'bg-blue-50 text-blue-700 border-blue-300',
  befaring: 'bg-green-50 text-green-700 border-green-300',
  fri_befaring: 'bg-orange-50 text-orange-700 border-orange-300',
  photo: 'bg-purple-50 text-purple-700 border-purple-300',
  user: 'bg-gray-50 text-gray-700 border-gray-300',
};
