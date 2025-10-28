/**
 * Supabase Storage utilities for Refusjon reports
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Upload PDF report to Supabase Storage and return signed URL
 */
export async function uploadReport(
  supabase: SupabaseClient,
  orgId: string,
  employeeId: string,
  periodMonth: string,
  buffer: Buffer,
  type: 'pdf' | 'csv'
): Promise<string> {
  // Generate unique filename
  const timestamp = Date.now();
  const extension = type === 'pdf' ? 'pdf' : 'csv';
  const filename = `${orgId}/${employeeId}/${periodMonth}_${timestamp}.${extension}`;
  
  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('refusjon-reports')
    .upload(filename, buffer, {
      contentType: type === 'pdf' ? 'application/pdf' : 'text/csv',
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Error uploading report:', uploadError);
    throw new Error(`Failed to upload ${type} report: ${uploadError.message}`);
  }

  // Generate signed URL (valid for 7 days)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('refusjon-reports')
    .createSignedUrl(filename, 60 * 60 * 24 * 7); // 7 days

  if (urlError || !urlData) {
    console.error('Error creating signed URL:', urlError);
    throw new Error('Failed to create signed URL');
  }

  return urlData.signedUrl;
}

/**
 * Get public or signed URL for a report
 */
export async function getReportUrl(
  supabase: SupabaseClient,
  filename: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('refusjon-reports')
    .createSignedUrl(filename, 60 * 60 * 24 * 7);

  if (error || !data) {
    console.error('Error getting report URL:', error);
    throw new Error('Failed to get report URL');
  }

  return data.signedUrl;
}


