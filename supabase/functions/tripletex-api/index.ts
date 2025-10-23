import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { 
  requireOrgAccess, 
  requireAdminOrManager, 
  createErrorResponse 
} from '../_shared/auth-helpers.ts';

// Database-backed rate limiting for persistence across cold starts
async function checkRateLimit(identifier: string, maxRequests: number = 100, windowSeconds: number = 60): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    });
    
    if (error) {
      console.error('Rate limit check error:', error);
      // On error, allow the request (fail open)
      return true;
    }
    
    return data === true;
  } catch (error) {
    console.error('Rate limit exception:', error);
    // On exception, allow the request (fail open)
    return true;
  }
}

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIp || 'unknown';
}

interface TripletexConfig {
  consumerToken: string;
  employeeToken: string;
  baseUrl: string;
}

interface TripletexResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
}

interface TripletexEmployeeRecord {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
}

interface TripletexListMeta {
  isLastPage?: boolean;
  nextPage?: number | null;
  page?: number;
  totalPages?: number;
  numberOfPages?: number;
  totalCount?: number;
  countTotal?: number;
  totalMatches?: number;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Helper utilities for safe logging
function maskToken(token: string): string {
  if (!token) return '';
  return token.length <= 8 ? '****' : `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function maskAuthHeader(auth?: string): string {
  if (!auth) return '';
  if (auth.startsWith('Basic ')) return 'Basic ****';
  return '****';
}

function normalizeTimestamp(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function getHeader(headers: Record<string, string> | undefined, name: string): string | null {
  if (!headers) return null;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return null;
}

function pickFirstString(source: Record<string, unknown> | undefined | null, keys: string[]): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function safeBody(body: unknown) {
  if (!body) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    out[k] = k.toLowerCase().includes('token') ? '***masked***' : (body as Record<string, unknown>)[k];
  }
  return out;
}

// Extract token from base64-encoded JSON if needed
function extractTokenFromBase64(base64Token: string): string {
  if (!base64Token) return base64Token;
  try {
    const decoded = atob(base64Token);
    const parsed = JSON.parse(decoded);
    return parsed.token || base64Token;
  } catch {
    return base64Token;
  }
}

async function getTripletexConfig(orgId: string): Promise<TripletexConfig> {
  console.log('getTripletexConfig called with orgId:', orgId);
  
  // First, try to get tokens from integration settings for this org
  const { data: settings, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('org_id', orgId)
    .eq('integration_type', 'tripletex')
    .maybeSingle();
  
  console.log('Integration settings query result:', { settings, error });

  if (settings?.settings) {
    const orgSettings = settings.settings as { 
      consumer_token?: string; 
      employee_token?: string; 
      consumer_token_encrypted?: string;
      employee_token_encrypted?: string;
      api_base_url?: string;
    };
    
    console.log('Processing org settings:', { 
      hasConsumerToken: !!(orgSettings.consumer_token || orgSettings.consumer_token_encrypted),
      hasEmployeeToken: !!(orgSettings.employee_token || orgSettings.employee_token_encrypted),
      isEncrypted: !!(orgSettings.consumer_token_encrypted && orgSettings.employee_token_encrypted)
    });
    
    let consumerToken = orgSettings.consumer_token;
    let employeeToken = orgSettings.employee_token;
    
    // Decrypt tokens if they are encrypted
    if (orgSettings.consumer_token_encrypted && orgSettings.employee_token_encrypted) {
      try {
        // Use SQL function to decrypt
        const { data: decryptedConsumer } = await supabase.rpc('decrypt_token', {
          encrypted: orgSettings.consumer_token_encrypted
        });
        
        const { data: decryptedEmployee } = await supabase.rpc('decrypt_token', {
          encrypted: orgSettings.employee_token_encrypted
        });
        
        if (decryptedConsumer && decryptedEmployee) {
          consumerToken = decryptedConsumer;
          employeeToken = decryptedEmployee;
          console.log('Successfully decrypted tokens');
        }
      } catch (decryptError) {
        console.error('Failed to decrypt tokens:', decryptError);
        throw new Error('Failed to decrypt API tokens. Please check encryption configuration.');
      }
    }
    
    if (consumerToken && employeeToken) {
      const config = {
        consumerToken: consumerToken,
        employeeToken: employeeToken,
        baseUrl: orgSettings.api_base_url || 'https://api-test.tripletex.tech/v2'
      };
      console.log('Returning config:', { hasConsumerToken: !!config.consumerToken, hasEmployeeToken: !!config.employeeToken, baseUrl: config.baseUrl });
      return config;
    }
  }

  // Fallback to environment variables (legacy)
  const fallbackConfig = {
    consumerToken: Deno.env.get('TRIPLETEX_CONSUMER_TOKEN') ?? '',
    employeeToken: Deno.env.get('TRIPLETEX_EMPLOYEE_TOKEN') ?? '',
    baseUrl: Deno.env.get('TRIPLETEX_API_BASE') ?? 'https://api-test.tripletex.tech/v2'
  };
  console.log('Using fallback config (env vars):', {
    hasConsumerToken: !!fallbackConfig.consumerToken,
    hasEmployeeToken: !!fallbackConfig.employeeToken,
    baseUrl: fallbackConfig.baseUrl
  });
  return fallbackConfig;
}

// Get last sync time for changesSince parameter
async function getLastSyncTime(orgId: string, resourceType: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('tripletex_sync_state')
      .select('tripletex_last_modified, last_synced')
      .eq('org_id', orgId)
      .eq('resource_type', resourceType)
      .eq('resource_id', 'list')
      .order('tripletex_last_modified', { ascending: false })
      .limit(1);
    
    if (error) {
      console.warn('Failed to get last sync time:', error);
      return null;
    }
    
    const latest = data?.[0];
    return latest?.tripletex_last_modified || latest?.last_synced || null;
  } catch (error) {
    console.warn('Failed to get last sync time:', error);
    return null;
  }
}

// Create or reuse a Tripletex session token for this org
async function getOrCreateSession(orgId: string): Promise<{ token: string; expirationDate: string; companyId: number }> {
  const config = await getTripletexConfig(orgId);
  if (!config.consumerToken || !config.employeeToken) {
    throw new Error('Tripletex tokens not configured for this organization');
  }

  // Read existing settings to check cached session
  const { data: row, error: readErr } = await supabase
    .from('integration_settings')
    .select('id, settings')
    .eq('org_id', orgId)
    .eq('integration_type', 'tripletex')
    .maybeSingle();

  if (readErr) {
    console.error('Error reading integration settings for session:', readErr);
  }

  const currentSettings = (row?.settings as Record<string, unknown>) || {};
  const now = new Date();

  // Check if we have a valid cached session with companyId
  if (currentSettings.session_token && currentSettings.session_expires_at && currentSettings.company_id) {
    const expiresAt = new Date(currentSettings.session_expires_at);
    // Add 60s safety margin
    if (expiresAt.getTime() - 60000 > now.getTime()) {
      return { 
        token: String(currentSettings.session_token), 
        expirationDate: expiresAt.toISOString().split('T')[0],
        companyId: Number(currentSettings.company_id)
      };
    }
  }

  // Create new session
  const defaultDays = Number(Deno.env.get('SESSION_DEFAULT_DAYS') ?? '7');
  const expirationDate = new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Use base64 tokens directly (don't decode)
  const consumerToken = config.consumerToken;
  const employeeToken = config.employeeToken;

  // Build URL with query params as per requirement
  const sessionUrl = new URL(`${config.baseUrl}/token/session/:create`);
  sessionUrl.searchParams.set('consumerToken', consumerToken);
  sessionUrl.searchParams.set('employeeToken', employeeToken);
  sessionUrl.searchParams.set('expirationDate', expirationDate);

  console.log('Creating new Tripletex session for org', orgId, 'expiring', expirationDate);
  console.log('Tripletex session request', {
    url: sessionUrl.toString().replace(consumerToken, '***masked***').replace(employeeToken, '***masked***'),
    method: 'PUT',
    queryParams: {
      consumerToken: maskToken(consumerToken),
      employeeToken: maskToken(employeeToken),
      expirationDate
    }
  });

  const resp = await fetch(sessionUrl.toString(), {
    method: 'PUT'
    // No body or headers needed - all in query params
  });

  const text = await resp.text();
  let data: unknown = {};
  try { 
    data = JSON.parse(text); 
  } catch (error) {
    console.debug('Failed to parse JSON response:', error);
  }

  console.log('Tripletex session response', { 
    status: resp.status, 
    success: resp.ok,
    bodyLen: text.length 
  });

  if (!resp.ok) {
    const errorMsg = data?.message || 'Unknown error';
    console.error('Failed to create Tripletex session:', { 
      status: resp.status, 
      error: errorMsg,
      validationMessages: data?.validationMessages || []
    });
    
    // Handle specific error codes
    if (resp.status === 401) {
      throw new Error('Ugyldig API-nøkler. Sjekk consumer_token og employee_token.');
    } else if (resp.status === 422) {
      const validationErrors = data?.validationMessages?.map(v => v.message).join(', ') || 'Valideringsfeil';
      throw new Error(`Valideringsfeil fra Tripletex: ${validationErrors}`);
    } else {
      throw new Error(errorMsg || `HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
  }

  // Extract token and companyId from response
  const token = data?.value?.token ?? data?.token ?? data?.value?.[0]?.token;
  const companyId = data?.value?.loggedInEmployeeId ?? data?.loggedInEmployeeId ?? data?.value?.employee?.company?.id ?? 0;
  const exp = data?.value?.expirationDate ?? data?.expirationDate ?? expirationDate;

  if (!token) {
    console.error('Tripletex session response missing token:', data);
    throw new Error('Tripletex returnerte ikke en session token');
  }

  // Persist session token and companyId into settings
  const newSettings = {
    ...currentSettings,
    session_token: token,
    session_expires_at: exp,
    company_id: companyId
  };

  const { error: writeErr } = await supabase
    .from('integration_settings')
    .update({ settings: newSettings })
    .eq('id', row?.id as string);

  if (writeErr) {
    console.error('Failed saving session token to settings:', writeErr);
  }

  return { token: String(token), expirationDate: String(exp), companyId: Number(companyId) };
}

// Helper function to generate checksum for data
function generateChecksum(data: unknown): string {
  const str = JSON.stringify(data, Object.keys(data as Record<string, unknown>).sort());
  // Simple hash function (in production, consider using crypto.subtle)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

// Helper function to update sync state
async function updateSyncState(
  orgId: string,
  resourceType: string,
  resourceId: string,
  checksum?: string | null,
  options: {
    lastModified?: string | null;
    tripletexChecksum?: string | null;
    tripletexLastModified?: string | null;
  } = {}
) {
  try {
    const nowIso = new Date().toISOString();
    const tripletexLastModifiedIso = normalizeTimestamp(options.tripletexLastModified);
    const lastModifiedIso = normalizeTimestamp(options.lastModified ?? options.tripletexLastModified);
    console.log(`Updating sync state for ${resourceType}:${resourceId} with checksum ${checksum} and Tripletex markers`, {
      tripletexChecksum: options.tripletexChecksum,
      tripletexLastModified: tripletexLastModifiedIso
    });
    const { error } = await supabase
      .from('tripletex_sync_state')
      .upsert({
        org_id: orgId,
        resource_type: resourceType,
        resource_id: resourceId.toString(),
        checksum: checksum ?? null,
        tripletex_checksum: options.tripletexChecksum ?? null,
        tripletex_last_modified: tripletexLastModifiedIso,
        last_modified: lastModifiedIso,
        last_synced: nowIso,
        updated_at: nowIso
      }, {
        onConflict: 'org_id,resource_type,resource_id'
      });
    
    if (error) {
      console.error('Failed to update sync state:', error);
    } else {
      console.log(`Successfully updated sync state for ${resourceType}:${resourceId}`);
    }
  } catch (error) {
    console.warn('Failed to update sync state:', error);
  }
}

// Helper function to get stored checksum
async function getStoredChecksum(orgId: string, resourceType: string, resourceId: string): Promise<string | null> {
  try {
    console.log(`Getting checksum for ${resourceType}:${resourceId} in org ${orgId}`);
    const { data, error } = await supabase
      .from('tripletex_sync_state')
      .select('checksum, tripletex_checksum')
      .eq('org_id', orgId)
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId.toString())
      .maybeSingle();
    
    if (error) {
      console.warn('Failed to get stored checksum:', error);
      return null;
    }
    
    const checksum = data?.checksum || data?.tripletex_checksum || null;
    console.log(`Retrieved checksum for ${resourceType}:${resourceId}:`, checksum);
    return checksum;
  } catch (error) {
    console.warn('Failed to get stored checksum:', error);
    return null;
  }
}

async function callTripletexAPI(endpoint: string, method: string = 'GET', body?: unknown, orgId?: string, customHeaders?: Record<string, string>): Promise<TripletexResponse> {
  const config = await getTripletexConfig(orgId || '');
  if (!config.consumerToken || !config.employeeToken) {
    return { success: false, error: 'Tripletex tokens not configured for this organization' };
  }
  const url = `${config.baseUrl}${endpoint}`;
  let headers: Record<string, string> = { 
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'FieldNote/1.0 (Tripletex Integration)',
  'X-Requested-With': 'XMLHttpRequest',
  ...customHeaders
};

  // Use session token for all non-session endpoints
  if (!endpoint.startsWith('/token/session')) {
    try {
      const session = await getOrCreateSession(orgId!);
      headers = {
        ...headers,
        Authorization: `Basic ${btoa(`${session.companyId}:${session.token}`)}`
      };
    } catch (e) {
      return { success: false, error: (e as Error).message || 'Failed to create session' };
    }
  }

  try {
    console.log(`Calling Tripletex API: ${method} ${url}`);
    console.log('Tripletex request headers', { hasAuth: !!headers.Authorization, auth: maskAuthHeader(headers.Authorization) });
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let responseData: unknown = {};
    
    // Only try to parse JSON if there's content and it's not a 204 (No Content) response
    if (text && response.status !== 204) {
      try { 
        responseData = JSON.parse(text); 
      } catch (error) {
        console.debug('Failed to parse JSON response:', error);
      }
    }

    console.log('Tripletex API response', { status: response.status, url });

    if (!response.ok) {
      // Optional: throw on 429/5xx to let exponentialBackoff handle it
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        const err: Error = new Error(responseData?.message || `HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }
      console.error('Tripletex API error:', { 
        status: response.status, 
        url: url,
        message: responseData?.message,
        validationMessages: responseData?.validationMessages,
        fullResponse: responseData 
      });
      
      // Include validation details in error message if available
      let errorMessage = responseData?.message || `HTTP ${response.status}`;
      if (responseData?.validationMessages && Array.isArray(responseData.validationMessages)) {
        const validationDetails = responseData.validationMessages.map((v: any) => v.message || v).join(', ');
        errorMessage += ` (Detaljer: ${validationDetails})`;
      }
      
      return { 
        success: false, 
        error: errorMessage,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    }

    return { 
      success: true, 
      data: responseData, 
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error: unknown) {
    console.error('Network error calling Tripletex API:', error);
    return { success: false, error: error.message ?? String(error) };
  }
}

async function fetchAllTripletexEmployees(orgId: string) {
  console.log(`🔍 fetchAllTripletexEmployees called for org ${orgId}`);
  const pageSize = 100;
  let currentPage = 0;
  const employees: TripletexEmployeeRecord[] = [];
  const visitedPages = new Set<number>();
  let totalFromMeta: number | undefined;
  let pagesFetched = 0;
  let latestChecksum: string | null = null;
  let latestLastModified: string | null = null;
  
  // Get last sync time for changesSince parameter
  const lastSyncTime = await getLastSyncTime(orgId, 'employee');
  const changesSinceParam = lastSyncTime ? `&changesSince=${encodeURIComponent(lastSyncTime)}` : '';
  
  // Get stored checksum for employee list
  const storedChecksum = await getStoredChecksum(orgId, 'employee', 'list');
  const headers = storedChecksum ? { 'If-None-Match': storedChecksum } : {};

  while (pagesFetched < 100) { // safety guard to avoid infinite loops
    if (visitedPages.has(currentPage)) {
      console.warn('Pagination loop detected while fetching Tripletex employees', { orgId, currentPage });
      break;
    }

    visitedPages.add(currentPage);
    pagesFetched += 1;

    const response = await callTripletexAPI(`/employee?count=${pageSize}&page=${currentPage}&fields=id,firstName,lastName,email${changesSinceParam}`, 'GET', undefined, orgId, headers);

    // Check if we got a 304 Not Modified response (only on first page)
    if (currentPage === 0 && response.status === 304) {
      console.log(`✅ No changes detected for employees (304 Not Modified)`);
      return { success: true, data: [], count: 0 };
    }
    
    if (!response.success) {
      return {
        success: false,
        error: response.error,
        meta: { pagesFetched, totalFromMeta }
      } as const;
    }

    const pageEmployees = Array.isArray(response.data?.values)
      ? (response.data.values as TripletexEmployeeRecord[])
      : [];

    const responseMeta = ((response.data as { meta?: Record<string, unknown> })?.meta) || null;
    const pageLastModifiedCandidate = getHeader(response.headers, 'last-modified')
      ?? getHeader(response.headers, 'x-last-modified')
      ?? pickFirstString(responseMeta, ['lastModifiedDate', 'lastModified', 'lastChanged', 'updatedAt', 'changedAt']);
    const normalizedPageLastModified = normalizeTimestamp(pageLastModifiedCandidate);
    if (normalizedPageLastModified && (!latestLastModified || normalizedPageLastModified > latestLastModified)) {
      latestLastModified = normalizedPageLastModified;
    }

    // Store ETag checksum from first page
    if (currentPage === 0) {
      const newChecksum = getHeader(response.headers, 'etag') || (response.data as { versionDigest?: string })?.versionDigest;
      if (newChecksum) {
        latestChecksum = newChecksum;
        await updateSyncState(orgId, 'employee', 'list', newChecksum, {
          tripletexChecksum: newChecksum,
          tripletexLastModified: normalizedPageLastModified ?? latestLastModified
        });
        console.log(`✅ Updated ETag checksum for employee list: ${newChecksum}`);
      }
    }
    
    // Process all employees since we got new data
    employees.push(...pageEmployees);

    const meta = response.data?.meta as TripletexListMeta | undefined;
    const links = (response.data?.links || response.data?._links) as { next?: string | null } | undefined;
    if (typeof meta?.totalCount === 'number') {
      totalFromMeta = meta.totalCount;
    } else if (typeof meta?.countTotal === 'number') {
      totalFromMeta = meta.countTotal;
    } else if (typeof meta?.totalMatches === 'number') {
      totalFromMeta = meta.totalMatches;
    }

    const expectedTotal = totalFromMeta;
    const collectedCount = employees.length;

    const isLastPage = meta?.isLastPage === true
      || pageEmployees.length < pageSize
      || (typeof expectedTotal === 'number' && collectedCount >= expectedTotal)
      || (typeof meta?.totalPages === 'number' && (meta.page ?? currentPage) >= meta.totalPages - 1)
      || (typeof meta?.numberOfPages === 'number' && (meta.page ?? currentPage) >= meta.numberOfPages - 1)
      || meta?.nextPage === null;

    if (isLastPage) {
      break;
    }

    if (typeof meta?.nextPage === 'number') {
      currentPage = meta.nextPage;
    } else {
      let nextFromLink: number | undefined;
      const linkCandidate = links?.next;
      if (typeof linkCandidate === 'string') {
        try {
          const parsed = new URL(linkCandidate, 'https://dummy.tripletex.local');
          const pageParam = parsed.searchParams.get('page');
          if (pageParam !== null) {
            const parsedPage = Number(pageParam);
            if (!Number.isNaN(parsedPage)) {
              nextFromLink = parsedPage;
            }
          }
        } catch (error) {
          console.warn('Failed to parse Tripletex pagination link', { error, linkCandidate });
        }
      }

      currentPage = typeof nextFromLink === 'number' ? nextFromLink : currentPage + 1;
    }
  }

  console.log(`🔍 fetchAllTripletexEmployees returning ${employees.length} employees`);

  if (latestChecksum || latestLastModified) {
    await updateSyncState(orgId, 'employee', 'list', latestChecksum, {
      tripletexChecksum: latestChecksum,
      tripletexLastModified: latestLastModified
    });
  }

  return {
    success: true,
    employees,
    meta: {
      pagesFetched,
      totalFromMeta
    }
  } as const;
}

// === helpers: participant & activity checks ===
async function getProjectParticipantIds(orgId: string, projectId: number) {
  const res = await callTripletexAPI(`/project/${projectId}?fields=participants`, 'GET', undefined, orgId);
  if (!res.success) return [];
  const ids = (res.data?.value?.participants || []).map((p: unknown) => (p as { id: number }).id).filter((x: unknown) => typeof x === 'number');
  return ids;
}

async function isEmployeeParticipant(orgId: string, projectId: number, employeeId: number) {
  const ids = await getProjectParticipantIds(orgId, projectId);
  for (const pid of ids) {
    const p = await callTripletexAPI(`/project/participant/${pid}?fields=employee`, 'GET', undefined, orgId);
    const pEmpId = p?.data?.value?.employee?.id;
    if (p.success && Number(pEmpId) === Number(employeeId)) {
      return { found: true, participantId: pid };
    }
  }
  return { found: false };
}

async function ensureParticipant(orgId: string, projectId: number, employeeId: number) {
  const existing = await isEmployeeParticipant(orgId, projectId, employeeId);
  if (existing.found) return { ok: true, participantId: existing.participantId };

  const body = { project: { id: Number(projectId) }, employee: { id: Number(employeeId) } };
  const addRes = await callTripletexAPI('/project/participant', 'POST', body, orgId);

  const after = await isEmployeeParticipant(orgId, projectId, employeeId);
  if (after.found) return { ok: true, participantId: after.participantId };

  return { ok: false, reason: addRes.error || 'could_not_add_participant' };
}

async function ensureActivityOnProject(orgId: string, projectId: number, activityId: number) {
  const res = await callTripletexAPI(`/activity?project.id=${projectId}&count=1000&fields=id,name`, 'GET', undefined, orgId);
  if (!res.success) return { ok: false, reason: res.error || 'activity_lookup_failed' };
  const list = res.data?.values || [];
  const found = list.some((a: unknown) => Number((a as { id: number })?.id) === Number(activityId));
  return { ok: found, reason: found ? undefined : 'activity_not_on_project' };
}
// === end helpers ===

async function exponentialBackoff(fn: () => Promise<unknown>, maxRetries: number = 3): Promise<unknown> {
  let delay = 1000; // Start with 1 second
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (i === maxRetries - 1) throw error;
      
      const status = error?.status;
      if (status === 429 || (status >= 500 && status < 600)) {
        console.log(`Retrying after ${delay}ms (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error; // Don't retry for other errors
      }
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) {
    return preflightResponse;
  }
  
  // Rate limiting check (database-backed for persistence)
  const clientId = getClientIdentifier(req);
  const rateLimitAllowed = await checkRateLimit(clientId, 100, 60); // 100 requests per 60 seconds
  if (!rateLimitAllowed) {
    const corsHeaders = getCorsHeaders(req.headers.get('origin') || undefined);
    return new Response(
      JSON.stringify({ 
        error: 'Rate limit exceeded', 
        message: 'Too many requests. Please try again later.' 
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      }
    );
  }
  
  // Get CORS headers for the request
  const requestOrigin = req.headers.get('origin') || undefined;
  const corsHeaders = getCorsHeaders(requestOrigin);

  // Authentication check - verify JWT token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'Missing authorization header' 
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Create Supabase client with auth header
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );

  // Verify the user is authenticated
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  
  if (authError || !user) {
    console.error('Authentication failed:', authError?.message);
    return new Response(
      JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'Invalid or expired token' 
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  console.log('✅ Authenticated user:', user.email);

  try {
    const url = new URL(req.url);
    // Try to extract action and orgId from URL or request body (supports both styles)
    let action = url.searchParams.get('action');
    let orgId = url.searchParams.get('orgId');

    let payload: unknown = {};
    try {
      // Try to read JSON body once and reuse for all cases
      payload = await req.json();
    } catch (_) {
      // No JSON body provided
    }

    if (!action) {
      if (payload?.action) action = payload.action;
      else if (payload?.params) {
        const p = new URLSearchParams(payload.params as string);
        action = p.get('action') || action;
        orgId = orgId || p.get('orgId') || undefined;
      }
    }

    if (!orgId && payload?.orgId) orgId = payload.orgId;

    if (!action || !orgId) {
      return new Response(JSON.stringify({ error: 'Missing action or orgId parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('tripletex-api invoked', { action, orgId, user: user.email });

    // ==================== AUTHORIZATION CHECK ====================
    // Verify that the user has access to this organization
    const profileOrError = await requireOrgAccess(authHeader, orgId, 'user');
    
    if ('error' in profileOrError) {
      return createErrorResponse(profileOrError, corsHeaders);
    }
    
    const profile = profileOrError;
    console.log('✅ Authorization passed:', { 
      user: user.email, 
      org: orgId, 
      role: profile.role,
      action 
    });

    // Check if action requires elevated privileges (admin/manager only)
    const privilegedActions = [
      'sync-employees',
      'sync-projects', 
      'sync-activities',
      'export-timesheet',
      'approve_timesheet_entries',
      'unapprove_timesheet_entries',
      'test-session',
      'check-config'
    ];
    
    if (privilegedActions.includes(action)) {
      const adminCheckOrError = await requireAdminOrManager(authHeader, orgId);
      
      if ('error' in adminCheckOrError) {
        console.warn(`Access denied: ${action} requires admin/manager role`);
        return createErrorResponse(adminCheckOrError, corsHeaders);
      }
      
      console.log(`✅ Privileged action authorized: ${action}`);
    }
    // ==================== END AUTHORIZATION CHECK ====================

    let result: TripletexResponse;

    switch (action) {
      case 'check-config': {
        const checkConfig = await getTripletexConfig(orgId);
        result = {
          success: true,
          data: {
            hasConsumerToken: !!checkConfig.consumerToken,
            hasEmployeeToken: !!checkConfig.employeeToken,
            baseUrl: checkConfig.baseUrl
          }
        };
        break;
      }

      case 'test-session': {
        try {
          console.log(`Testing session creation for org ${orgId}`);
          const session = await getOrCreateSession(orgId);
          console.log(`Session test successful: token length=${session.token.length}, expires=${session.expirationDate}`);
          result = { 
            success: true, 
            data: { 
              token: maskToken(session.token), 
              expirationDate: session.expirationDate,
              tokenLength: session.token.length
            } 
          };
        } catch (e: unknown) {
          console.error('Session test failed:', e instanceof Error ? e.message : 'Unknown error');
          result = { success: false, error: e instanceof Error ? e.message : 'Failed to create session' };
        }
        break;
      }

      case 'sync-employees': {
        console.log(`🚀 SYNC-EMPLOYEES STARTED - Version 0.2.126`);
        result = await exponentialBackoff(async () => {
          const employeeFetch = await fetchAllTripletexEmployees(orgId);
          if (!employeeFetch.success) {
            return { success: false, error: employeeFetch.error };
          }

          const rawEmployees = employeeFetch.employees ?? [];

          if (rawEmployees.length === 0) {
            console.log(`Syncing 0 employees for org ${orgId}`);
          } else {
            console.log(`Syncing ${rawEmployees.length} employees for org ${orgId}`, {
              pagesFetched: employeeFetch.meta?.pagesFetched,
              totalFromMeta: employeeFetch.meta?.totalFromMeta
            });
          }

          // Cache employees in database
          const employees = rawEmployees.map((emp: TripletexEmployeeRecord) => ({
            org_id: orgId,
            tripletex_employee_id: emp.id,
            fornavn: emp.firstName || '',
            etternavn: emp.lastName || '',
            epost: emp.email,
            aktiv: emp.isActive !== false, // Default to true if undefined
            last_synced: new Date().toISOString()
          }));

          const { error: upsertError } = await supabase
            .from('ttx_employee_cache')
            .upsert(employees, { 
              onConflict: 'org_id,tripletex_employee_id',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            console.error('Error upserting employees:', upsertError);
            return { success: false, error: `Database error: ${upsertError.message}` };
          }

          // Create person records for each employee
          const persons = employees.map((emp) => ({
            org_id: orgId,
            fornavn: emp.fornavn,
            etternavn: emp.etternavn,
            epost: emp.epost,
            tripletex_employee_id: emp.tripletex_employee_id,
            aktiv: emp.aktiv,
            person_type: 'ansatt'
          }));

          if (persons.length > 0) {
            const { error: personError } = await supabase
              .from('person')
              .upsert(persons, {
                onConflict: 'org_id,tripletex_employee_id',
                ignoreDuplicates: false
              });

            if (personError) {
              console.error('Error upserting persons:', personError);
              return { success: false, error: `Person creation error: ${personError.message}` };
            }
          }

          // Auto-link existing profiles to Tripletex employees
          let profilesLinked = 0;
          const validEmployees = employees.filter(emp => 
            emp.epost && 
            emp.epost.includes('@') && 
            emp.aktiv
          );

          // Get all existing profiles in org with email from auth.users
          const { data: existingProfiles } = await supabase
            .from('profiles')
            .select('id, user_id, org_id, role')
            .eq('org_id', orgId);

          // Get user emails for these profiles
          const userIds = existingProfiles?.map(p => p.user_id) || [];
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const userEmailMap = new Map(
            authUsers.users
              .filter(u => userIds.includes(u.id))
              .map(u => [u.id, u.email?.toLowerCase()])
          );

          for (const emp of validEmployees) {
            try {
              const empEmail = emp.epost?.toLowerCase();
              if (!empEmail) continue;

              // Find profile with matching email
              const matchedProfile = existingProfiles?.find(p => 
                userEmailMap.get(p.user_id) === empEmail
              );

              if (matchedProfile) {
                // Profile exists - auto-link by updating person record
                // IMPORTANT: Do NOT change the role - keep existing role
                const { data: personData } = await supabase
                  .from('person')
                  .select('id')
                  .eq('org_id', orgId)
                  .eq('tripletex_employee_id', emp.tripletex_employee_id)
                  .maybeSingle();

                if (personData) {
                  profilesLinked++;
                  console.log(`Auto-linked profile to Tripletex: ${emp.fornavn} ${emp.etternavn} (role: ${matchedProfile.role})`);
                }
              }
            } catch (linkErr) {
              console.error(`Failed to auto-link ${emp.fornavn} ${emp.etternavn}:`, linkErr);
            }
          }

          console.log(`Successfully synced ${employees.length} employees and auto-linked ${profilesLinked} existing profiles`);
          return { 
            success: true, 
            data: { 
              employees: employees.length,
              profilesLinked: profilesLinked,
              validEmails: validEmployees.length
            } 
          };
        });
        break;
      }

      case 'sync-projects': {
        result = await exponentialBackoff(async () => {
          // Get last sync time for changesSince parameter
          const lastSyncTime = await getLastSyncTime(orgId, 'project');
          const changesSinceParam = lastSyncTime ? `&changesSince=${encodeURIComponent(lastSyncTime)}` : '';
          
          // Get stored checksum for this endpoint
          const storedChecksum = await getStoredChecksum(orgId, 'project', 'list');
          
          // Add If-None-Match header if we have a stored checksum
          const headers = storedChecksum ? { 'If-None-Match': storedChecksum } : {};
          console.log('🔍 Sending headers:', headers);
          console.log('🔍 Stored checksum:', storedChecksum);
          
          const response = await callTripletexAPI(`/project?count=100&fields=id,number,name,displayName,customer,department,projectManager,description,startDate,endDate,isActive,isClosed${changesSinceParam}`, 'GET', undefined, orgId, headers);
          
          // Check if we got a 304 Not Modified response
          if (response.status === 304) {
            console.log(`✅ No changes detected for projects (304 Not Modified)`);
            return { success: true, message: 'No changes detected', count: 0 };
          }
          
          if (response.success && response.data?.values) {
            console.log(`Syncing ${response.data.values.length} projects for org ${orgId}`);
            
            // Store the new ETag checksum from response
            console.log('🔍 Response headers:', Object.keys(response.headers || {}));
            console.log('🔍 ETag header:', response.headers?.['etag']);
            console.log('🔍 VersionDigest:', response.data?.versionDigest);
            
            const responseMeta = ((response.data as { meta?: Record<string, unknown> })?.meta) || null;
            const lastModifiedCandidate = getHeader(response.headers, 'last-modified')
              ?? getHeader(response.headers, 'x-last-modified')
              ?? pickFirstString(responseMeta, ['lastModifiedDate', 'lastModified', 'lastChanged', 'updatedAt', 'changedAt']);
            const normalizedLastModified = normalizeTimestamp(lastModifiedCandidate);

            const newChecksum = response.data?.versionDigest || getHeader(response.headers, 'etag');
            if (newChecksum || normalizedLastModified) {
              await updateSyncState(orgId, 'project', 'list', newChecksum ?? null, {
                tripletexChecksum: newChecksum ?? null,
                tripletexLastModified: normalizedLastModified
              });
            }

            if (newChecksum) {
              console.log(`✅ Updated ETag checksum for project list: ${newChecksum}`);
            } else {
              console.log('⚠️ No ETag found in response');
            }
            
            // Process all projects since we got new data
            const projectsToProcess = response.data.values;
            
            console.log(`Processing ${projectsToProcess.length} changed projects (out of ${response.data.values.length} total)`);
            
            // Debug: Log ALL projects with full details (for debugging closed projects)
            const debugProjects = projectsToProcess.map((p: unknown) => {
              const proj = p as any;
              return {
                id: proj.id,
                number: proj.number,
                name: proj.displayName || proj.name,
                isActive: proj.isActive,
                isClosed: proj.isClosed,
                endDate: proj.endDate,
                mainProjectId: proj.mainProjectId,
                projectCategoryId: proj.projectCategoryId
              };
            });
            console.log('DEBUG: Changed projects from Tripletex:', debugProjects);
            console.log('DEBUG: Closed projects:', debugProjects.filter((p: any) => p.isClosed === true));
            console.log('DEBUG: Projects with end date passed:', debugProjects.filter((p: any) => p.endDate && new Date(p.endDate) < new Date()));
            
            // Cache only changed projects in database
            const projects = projectsToProcess.map((proj: unknown) => {
              const project = proj as { 
                id: number; 
                number?: string; 
                displayName?: string; 
                name?: string; 
                customer?: { 
                  name?: string; 
                  email?: string; 
                  phoneNumber?: string; 
                }; 
                projectManager?: {
                  firstName?: string;
                  lastName?: string;
                  email?: string;
                  phoneNumber?: string;
                };
                description?: string;
                startDate?: string;
                endDate?: string;
                isActive?: boolean; 
                isClosed?: boolean; 
              };
              
              // Check multiple conditions to determine if project is truly active
              const isActive = 
                project.isActive !== false &&           // Not inactive
                project.isClosed !== true &&            // Not closed
                (!project.endDate || new Date(project.endDate) >= new Date());  // Not past end date
              
              return {
                org_id: orgId,
                tripletex_project_id: project.id,
                project_number: project.number,
                project_name: project.displayName || project.name,
                customer_name: project.customer?.name,
                customer_email: project.customer?.email,
                customer_phone: project.customer?.phoneNumber,
                project_manager_name: project.projectManager ? 
                  `${project.projectManager.firstName || ''} ${project.projectManager.lastName || ''}`.trim() : null,
                project_manager_email: project.projectManager?.email,
                project_manager_phone: project.projectManager?.phoneNumber,
                project_description: project.description,
                start_date: project.startDate,
                end_date: project.endDate,
                is_active: isActive,
                is_closed: project.isClosed || false,
                last_synced: new Date().toISOString()
              };
            });

            const { error: upsertError } = await supabase
              .from('ttx_project_cache')
              .upsert(projects, { 
                onConflict: 'org_id,tripletex_project_id',
                ignoreDuplicates: false 
              });

            if (upsertError) {
              console.error('Error upserting projects:', upsertError);
              return { success: false, error: `Database error: ${upsertError.message}` };
            }

            // 🎯 AUTOMATISK ARKIVERING: Arkiver befaringsrapporter når prosjekt blir inaktivt
            const inactiveProjects = projects.filter(p => !p.is_active);
            if (inactiveProjects.length > 0) {
              console.log(`🔄 Auto-archiving befaringsrapporter for ${inactiveProjects.length} inactive projects`);
              
              for (const project of inactiveProjects) {
                try {
                  // Arkiver alle aktive befaringsrapporter for dette prosjektet
                  const { data: archivedBefaringer, error: archiveError } = await supabase
                    .from('befaringer')
                    .update({ 
                      status: 'arkivert',
                      updated_at: new Date().toISOString()
                    })
                    .eq('org_id', orgId)
                    .eq('tripletex_project_id', project.tripletex_project_id)
                    .eq('status', 'aktiv')
                    .select('id, title');

                  if (archiveError) {
                    console.error(`Error archiving befaringsrapporter for project ${project.tripletex_project_id}:`, archiveError);
                  } else if (archivedBefaringer && archivedBefaringer.length > 0) {
                    console.log(`✅ Auto-archived ${archivedBefaringer.length} befaringsrapporter for project ${project.tripletex_project_id}:`, 
                      archivedBefaringer.map(b => b.title));
                  }

                  // Arkiver også fri befaringsrapporter for dette prosjektet
                  const { data: archivedFriBefaringer, error: archiveFriError } = await supabase
                    .from('fri_befaringer')
                    .update({ 
                      status: 'arkivert',
                      updated_at: new Date().toISOString()
                    })
                    .eq('org_id', orgId)
                    .eq('tripletex_project_id', project.tripletex_project_id)
                    .eq('status', 'aktiv')
                    .select('id, title');

                  if (archiveFriError) {
                    console.error(`Error archiving fri befaringsrapporter for project ${project.tripletex_project_id}:`, archiveFriError);
                  } else if (archivedFriBefaringer && archivedFriBefaringer.length > 0) {
                    console.log(`✅ Auto-archived ${archivedFriBefaringer.length} fri befaringsrapporter for project ${project.tripletex_project_id}:`, 
                      archivedFriBefaringer.map(b => b.title));
                  }
                } catch (archiveException) {
                  console.error(`Exception archiving befaringsrapporter for project ${project.tripletex_project_id}:`, archiveException);
                }
              }
            }

            // 🎯 AUTOMATISK AKTIVERING: Aktiver befaringsrapporter når prosjekt blir aktivt igjen
            const activeProjects = projects.filter(p => p.is_active);
            if (activeProjects.length > 0) {
              console.log(`🔄 Auto-activating befaringsrapporter for ${activeProjects.length} active projects`);
              
              for (const project of activeProjects) {
                try {
                  // Aktiver alle arkiverte befaringsrapporter for dette prosjektet
                  const { data: activatedBefaringer, error: activateError } = await supabase
                    .from('befaringer')
                    .update({ 
                      status: 'aktiv',
                      updated_at: new Date().toISOString()
                    })
                    .eq('org_id', orgId)
                    .eq('tripletex_project_id', project.tripletex_project_id)
                    .eq('status', 'arkivert')
                    .select('id, title');

                  if (activateError) {
                    console.error(`Error activating befaringsrapporter for project ${project.tripletex_project_id}:`, activateError);
                  } else if (activatedBefaringer && activatedBefaringer.length > 0) {
                    console.log(`✅ Auto-activated ${activatedBefaringer.length} befaringsrapporter for project ${project.tripletex_project_id}:`, 
                      activatedBefaringer.map(b => b.title));
                  }

                  // Aktiver også fri befaringsrapporter for dette prosjektet
                  const { data: activatedFriBefaringer, error: activateFriError } = await supabase
                    .from('fri_befaringer')
                    .update({ 
                      status: 'aktiv',
                      updated_at: new Date().toISOString()
                    })
                    .eq('org_id', orgId)
                    .eq('tripletex_project_id', project.tripletex_project_id)
                    .eq('status', 'arkivert')
                    .select('id, title');

                  if (activateFriError) {
                    console.error(`Error activating fri befaringsrapporter for project ${project.tripletex_project_id}:`, activateFriError);
                  } else if (activatedFriBefaringer && activatedFriBefaringer.length > 0) {
                    console.log(`✅ Auto-activated ${activatedFriBefaringer.length} fri befaringsrapporter for project ${project.tripletex_project_id}:`, 
                      activatedFriBefaringer.map(b => b.title));
                  }
                } catch (activateException) {
                  console.error(`Exception activating befaringsrapporter for project ${project.tripletex_project_id}:`, activateException);
                }
              }
            }

            console.log(`Successfully synced ${projects.length} projects`);
            return { 
              success: true, 
              data: { 
                count: projects.length,
                debug: debugProjects  // Return debug info so it shows in browser console
              } 
            };
          }
          return response;
        });
        break;
      }

      case 'sync-activities': {
        result = await exponentialBackoff(async () => {
          // Get last sync time for changesSince parameter
          const lastSyncTime = await getLastSyncTime(orgId, 'activity');
          const changesSinceParam = lastSyncTime ? `&changesSince=${encodeURIComponent(lastSyncTime)}` : '';
          
          // Get stored checksum for activity list
          const storedChecksum = await getStoredChecksum(orgId, 'activity', 'list');
          const headers = storedChecksum ? { 'If-None-Match': storedChecksum } : {};
          
          const response = await callTripletexAPI(`/activity?count=1000&fields=id,name${changesSinceParam}`, 'GET', undefined, orgId, headers);
          
          // Check if we got a 304 Not Modified response
          if (response.status === 304) {
            console.log(`✅ No changes detected for activities (304 Not Modified)`);
            return { success: true, message: 'No changes detected', count: 0 };
          }
          
          if (response.success && response.data?.values) {
            const responseMeta = ((response.data as { meta?: Record<string, unknown> })?.meta) || null;
            const lastModifiedCandidate = getHeader(response.headers, 'last-modified')
              ?? getHeader(response.headers, 'x-last-modified')
              ?? pickFirstString(responseMeta, ['lastModifiedDate', 'lastModified', 'lastChanged', 'updatedAt', 'changedAt']);
            const normalizedLastModified = normalizeTimestamp(lastModifiedCandidate);

            // Store the new ETag checksum from response
            const newChecksum = getHeader(response.headers, 'etag') || response.data?.versionDigest;
            if (newChecksum || normalizedLastModified) {
              await updateSyncState(orgId, 'activity', 'list', newChecksum ?? null, {
                tripletexChecksum: newChecksum ?? null,
                tripletexLastModified: normalizedLastModified
              });
            }

            if (newChecksum) {
              console.log(`✅ Updated ETag checksum for activity list: ${newChecksum}`);
            }
            
            // Process all activities since we got new data
            const activitiesToProcess = response.data.values;
            
            console.log(`Processing ${activitiesToProcess.length} changed activities (out of ${response.data.values.length} total)`);
            
            // Cache only changed activities in database
            const activities = activitiesToProcess.map((act: unknown) => {
              const activity = act as { id: number; name?: string; isActive?: boolean };
              return {
                org_id: orgId,
                ttx_id: activity.id,
                navn: activity.name,
                aktiv: activity.isActive,
                last_synced: new Date().toISOString()
              };
            });

            const { error: upsertError } = await supabase
              .from('ttx_activity_cache')
              .upsert(activities, { 
                onConflict: 'org_id,ttx_id',
                ignoreDuplicates: false 
              });

            if (upsertError) {
              console.error('Error upserting activities:', upsertError);
              return { success: false, error: upsertError.message };
            }

            return { success: true, data: { count: activities.length } };
          }
          return response;
        });
        break;
      }

      case 'register-webhooks': {
        result = await exponentialBackoff(async () => {
          console.log(`🔔 Registering webhooks for org ${orgId}`);
          
          // Get webhook URL (use proxy URL for proper authentication)
          const webhookUrl = 'https://www.fieldnote.no/api/webhooks/tripletex';
          
          // First, clean up existing webhooks for our URL to avoid duplicates
          console.log(`🧹 Cleaning up existing webhooks for URL: ${webhookUrl}`);
          const existingWebhooks = await callTripletexAPI('/event/subscription?count=100', 'GET', undefined, orgId);
          
          let deletedCount = 0;
          let failedDeletions = 0;
          if (existingWebhooks.success && existingWebhooks.data?.values) {
            // Clean up BOTH old direct Supabase URL and new proxy URL
            const oldDirectUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/tripletex-webhook`;
            const ourExistingWebhooks = existingWebhooks.data.values.filter((webhook: any) => 
              webhook.targetUrl === webhookUrl || webhook.targetUrl === oldDirectUrl
            );
            
            console.log(`🗑️ Found ${ourExistingWebhooks.length} existing webhooks to clean up`);
            
            // Delete existing webhooks
            for (const webhook of ourExistingWebhooks) {
              const deleteResponse = await callTripletexAPI(`/event/subscription/${webhook.id}`, 'DELETE', undefined, orgId);
              if (deleteResponse.success) {
                console.log(`✅ Deleted existing webhook: ${webhook.event} (ID: ${webhook.id})`);
                deletedCount++;
              } else {
                console.log(`⚠️ Failed to delete webhook: ${webhook.event} (ID: ${webhook.id})`);
                failedDeletions++;
              }
            }
            
            // If we failed to delete any webhooks, warn about potential duplicates
            if (failedDeletions > 0) {
              console.log(`⚠️ WARNING: ${failedDeletions} webhooks could not be deleted - may result in duplicates!`);
            }
          }
          
          // Only proceed with registration if we successfully cleaned up or if there were no existing webhooks
          if (failedDeletions > 0 && deletedCount === 0) {
            console.log(`❌ Cannot proceed with webhook registration - failed to clean up existing webhooks`);
            return {
              success: false,
              error: `Failed to clean up ${failedDeletions} existing webhooks. Cannot register new webhooks to avoid duplicates.`,
              data: {
                failedDeletions,
                deletedCount: 0,
                message: 'Webhook cleanup failed - registration aborted to prevent duplicates'
              }
            };
          }
          
          // Register webhooks for different entity types
          const webhookRegistrations = [];
          
          // Employee webhook
          const employeeWebhook = await callTripletexAPI('/event/subscription', 'POST', {
            targetUrl: webhookUrl,
            event: 'employee.create',
            fields: '*'
          }, orgId);
          
          if (employeeWebhook.success) {
            webhookRegistrations.push({ type: 'employee', success: true });
            console.log('✅ Employee webhook registered');
          } else {
            webhookRegistrations.push({ type: 'employee', success: false, error: employeeWebhook.error });
            console.error('❌ Employee webhook registration failed:', employeeWebhook.error);
            
            // If webhook endpoint doesn't exist, stop trying other webhooks
            if (employeeWebhook.error && employeeWebhook.error.includes('404')) {
              console.log('⚠️ Webhook endpoint not found - stopping webhook registration');
              return {
                success: false,
                error: 'Tripletex API does not support webhook endpoints',
                data: {
                  supported: false,
                  message: 'Webhook registration failed - endpoint not available'
                }
              };
            }
          }
          
          // Project webhook
          const projectWebhook = await callTripletexAPI('/event/subscription', 'POST', {
            targetUrl: webhookUrl,
            event: 'project.create',
            fields: '*'
          }, orgId);
          
          if (projectWebhook.success) {
            webhookRegistrations.push({ type: 'project', success: true });
            console.log('✅ Project webhook registered');
          } else {
            webhookRegistrations.push({ type: 'project', success: false, error: projectWebhook.error });
            console.error('❌ Project webhook registration failed:', projectWebhook.error);
          }
          
          // Product webhook (since activity.create is not available in test environment)
          const productWebhook = await callTripletexAPI('/event/subscription', 'POST', {
            targetUrl: webhookUrl,
            event: 'product.create',
            fields: '*'
          }, orgId);
          
          if (productWebhook.success) {
            webhookRegistrations.push({ type: 'product', success: true });
            console.log('✅ Product webhook registered');
          } else {
            webhookRegistrations.push({ type: 'product', success: false, error: productWebhook.error });
            console.error('❌ Product webhook registration failed:', productWebhook.error);
          }
          
          // Customer webhook (since timesheetEntry is not available)
          const customerWebhook = await callTripletexAPI('/event/subscription', 'POST', {
            targetUrl: webhookUrl,
            event: 'customer.create',
            fields: '*'
          }, orgId);
          
          if (customerWebhook.success) {
            webhookRegistrations.push({ type: 'customer', success: true });
            console.log('✅ Customer webhook registered');
          } else {
            webhookRegistrations.push({ type: 'customer', success: false, error: customerWebhook.error });
            console.error('❌ Customer webhook registration failed:', customerWebhook.error);
          }
          
          const successCount = webhookRegistrations.filter(r => r.success).length;
          const totalCount = webhookRegistrations.length;
          
          console.log(`🔔 Webhook registration complete: ${successCount}/${totalCount} new webhooks registered successfully`);
          
          return {
            success: true,
            data: { 
              registrations: webhookRegistrations,
              successCount,
              totalCount,
              deletedCount,
              failedDeletions,
              webhookUrl
            }
          };
        });
        break;
      }

      case 'list-webhooks': {
        result = await exponentialBackoff(async () => {
          console.log(`🔍 Listing registered webhooks for org ${orgId}`);
          
          const response = await callTripletexAPI('/event/subscription?count=100', 'GET', undefined, orgId);
          
          console.log('🔍 Webhook API response:', JSON.stringify(response, null, 2));
          
          if (response.success && response.data?.values) {
            console.log(`📋 Found ${response.data.values.length} registered webhooks`);
            
            // Filter webhooks for our URLs (both old and new)
            const oldDirectUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/tripletex-webhook`;
            const newProxyUrl = 'https://www.fieldnote.no/api/webhooks/tripletex';
            const webhookUrl = newProxyUrl; // Use new proxy URL as primary
            const ourWebhooks = response.data.values.filter((webhook: any) => 
              webhook.targetUrl === oldDirectUrl || webhook.targetUrl === newProxyUrl
            );
            
            console.log(`🎯 Our webhooks: ${ourWebhooks.length}`);
            ourWebhooks.forEach((webhook: any) => {
              console.log(`  - ${webhook.event}: ${webhook.status} (ID: ${webhook.id})`);
            });
            
            return {
              success: true,
              data: {
                total: response.data.values.length,
                ourWebhooks: ourWebhooks.length,
                webhooks: ourWebhooks,
                webhookUrl
              }
            };
          } else if (response.error && response.error.includes('404')) {
            console.log(`⚠️ Webhook endpoint not found - Tripletex may not support webhooks`);
            return {
              success: false,
              error: 'Webhook endpoint not available in Tripletex API. Webhooks may not be supported.',
              data: {
                supported: false,
                message: 'Tripletex API does not support webhook endpoints'
              }
            };
          } else if (response.success && response.data && !response.data.values) {
            console.log(`📋 Webhook API returned data but no values array:`, response.data);
            return {
              success: true,
              data: {
                total: 0,
                ourWebhooks: 0,
                webhooks: [],
                webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/tripletex-webhook`,
                message: 'No webhooks found or API returned unexpected format'
              }
            };
          }
          
          return {
            success: false,
            error: response.error || 'Failed to fetch webhooks',
            data: {
              response: response
            }
          };
        });
        break;
      }

      case 'search-projects': {
        const query = url.searchParams.get('q') || '';
        result = await callTripletexAPI(`/project?count=50&displayName=${encodeURIComponent(query)}&fields=id,number,name,displayName,customer`, 'GET', undefined, orgId);
        
        // Cache search results
        if (result.success && result.data?.values) {
          const projects = result.data.values.map((proj: unknown) => {
            const project = proj as { id: number; number?: string; displayName?: string; name?: string; customer?: { name?: string }; isActive?: boolean };
            return {
              org_id: orgId,
              tripletex_project_id: project.id,
              project_number: project.number,
              project_name: project.displayName || project.name,
              customer_name: project.customer?.name,
              is_active: project.isActive,
              last_synced: new Date().toISOString()
            };
          });

          await supabase
            .from('ttx_project_cache')
            .upsert(projects, { 
              onConflict: 'org_id,tripletex_project_id',
              ignoreDuplicates: false 
            });
        }
        break;
      }

      case 'export-timesheet': {
        const timesheetEntries = payload?.timesheetEntries;
        const dryRun = payload?.dryRun === true;

        if (!timesheetEntries || !Array.isArray(timesheetEntries)) {
          return new Response(JSON.stringify({ error: 'Missing timesheetEntries array' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const exportResults = [];

        for (const entry of timesheetEntries) {
          try {
            // Map employee and activity IDs from cache tables
            const { data: employeeData } = await supabase
              .from('person')
              .select('tripletex_employee_id')
              .eq('id', entry.personId)
              .eq('org_id', orgId)
              .single();

            // Query activity data from cache
            const { data: activityData } = await supabase
              .from('ttx_activity_cache')
              .select('ttx_id')
              .eq('ttx_id', entry.activityId)
              .eq('org_id', orgId)
              .single();

            if (!employeeData?.tripletex_employee_id) {
              exportResults.push({ 
                id: entry.id, 
                success: false, 
                error: 'Ansatt ikke koblet til Tripletex - synkroniser ansatte først' 
              });
              continue;
            }

            if (!activityData?.ttx_id) {
              exportResults.push({ 
                id: entry.id, 
                success: false, 
                error: 'Aktivitet ikke funnet - synkroniser aktiviteter først' 
              });
              continue;
            }

            // Bygg Tripletex-entry for /timesheet/entry (ett og ett objekt)
            const entryDate = entry.date;
            const entryBody = {
              date: entryDate,
              employee: { id: parseInt(employeeData.tripletex_employee_id.toString()) },
              project:  { id: parseInt(entry.projectId.toString()) },
              activity: { id: parseInt(activityData.ttx_id.toString()) },
              hours: parseFloat(entry.hours.toString()),
              comment: entry.comment || ''
            };

            if (dryRun) {
              exportResults.push({ id: entry.id, success: true, dryRun: true, payload: entryBody });
              continue;
            }

            // Viktig: riktig endpoint
            const exportResult = await exponentialBackoff(async () => {
              return await callTripletexAPI('/timesheet/entry', 'POST', entryBody, orgId);
            });

            if (exportResult.success) {
              await supabase
                .from('vakt_timer')
                .update({
                  tripletex_entry_id: exportResult.data?.value?.id,
                  tripletex_synced_at: new Date().toISOString(),
                  sync_error: null,
                  status: 'sendt'
                })
                .eq('id', entry.id);

              exportResults.push({ id: entry.id, success: true, tripletexId: exportResult.data?.value?.id });
            } else {
              if (exportResult.error?.includes('locked') || exportResult.error?.includes('låst') || exportResult.error?.includes('period is closed')) {
                exportResults.push({ id: entry.id, success: false, error: 'Periode er låst i Tripletex - kontakt lønn', errorType: 'period_locked' });
              } else {
                exportResults.push({ id: entry.id, success: false, error: exportResult.error });
              }
            }
          } catch (error: unknown) {
            console.error(`Error exporting timesheet entry ${entry.id}:`, error);
            exportResults.push({ 
              id: entry.id, 
              success: false, 
              error: error.message 
            });
          }
        }

        result = { success: true, data: { results: exportResults } };
        break;
      }

      case 'verify-timesheet-entry': {
        const tripletexEntryId = payload?.tripletexEntryId;

        if (!tripletexEntryId) {
          return new Response(JSON.stringify({ error: 'Missing tripletexEntryId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const verifyResult = await callTripletexAPI(`/timesheet/entry/${tripletexEntryId}?fields=id,date,hours,employee,project,activity`, 'GET', undefined, orgId);
        result = { 
          success: true, 
          data: { 
            exists: verifyResult.success && verifyResult.data?.value,
            entry: verifyResult.data?.value || null,
            error: verifyResult.error || null
          }
        };
        break;
      }

      case 'send_timesheet_entry': {
        const { vakt_timer_id, employee_id, project_id, activity_id, overtime_activity_id, hours, date, is_overtime, description } = payload;
        
        if (!vakt_timer_id || !employee_id || !project_id || !hours || !date) {
          result = { success: false, error: 'Missing required fields for timesheet entry' };
          break;
        }

        // Check if this timer entry is already synced to Tripletex
        const { data: existingTimer, error: timerError } = await supabase
          .from('vakt_timer')
          .select('tripletex_entry_id, tripletex_synced_at, status, lonnstype')
          .eq('id', vakt_timer_id)
          .single();

        if (timerError) {
          console.error('Error checking existing timer:', timerError);
          result = { success: false, error: 'Could not check existing timer status' };
          break;
        }

        if (existingTimer?.tripletex_entry_id) {
          console.log('⚠️ Timer already synced to Tripletex:', { 
            tripletexId: existingTimer.tripletex_entry_id,
            syncedAt: existingTimer.tripletex_synced_at,
            status: existingTimer.status
          });
          result = { 
            success: false, 
            error: 'Timer er allerede sendt til Tripletex. Bruk "Hent tilbake" for å oppdatere.',
            alreadySynced: true,
            tripletexId: existingTimer.tripletex_entry_id
          };
          break;
        }

        // Store original values before sending to Tripletex
        const { data: originalTimer, error: originalError } = await supabase
          .from('vakt_timer')
          .select('timer, aktivitet_id, notat, status')
          .eq('id', vakt_timer_id)
          .single();

        if (originalError) {
          console.error('Error fetching original timer values:', originalError);
          result = { success: false, error: 'Could not fetch original timer values' };
          break;
        }

        // Update with original values before sending
        const { error: storeOriginalError } = await supabase
          .from('vakt_timer')
          .update({
            original_timer: originalTimer?.timer,
            original_aktivitet_id: originalTimer?.aktivitet_id,
            original_notat: originalTimer?.notat,
            original_status: originalTimer?.status
          })
          .eq('id', vakt_timer_id);

        if (storeOriginalError) {
          console.error('Error storing original values:', storeOriginalError);
          result = { success: false, error: 'Could not store original values' };
          break;
        }

        result = await exponentialBackoff(async () => {
          // 4) Bygg korrekt payload for /timesheet/entry (IKKE array, IKKE clientReference, IKKE count/description)
          const entryDate = new Date(date).toISOString().split('T')[0];
          const hoursNumber = parseFloat(hours.toString().replace(',', '.'));

          console.log('📋 Timesheet entry details:', {
            vaktTimerId: vakt_timer_id,
            employeeId: employee_id,
            projectId: project_id,
            activityId: activity_id,
            hours: hoursNumber,
            date: entryDate,
            isOvertime: is_overtime,
            description: description,
            orgId: orgId
          });

          // Handle overtime by using separate activity field
          let finalActivityId = activity_id;
          let is50Percent = false; // Default to 100% overtime
          
          if (is_overtime && overtime_activity_id) {
            console.log('✅ Using specific overtime activity from frontend:', { 
              originalActivity: activity_id, 
              overtimeActivity: overtime_activity_id 
            });
            finalActivityId = overtime_activity_id;
            
            // Determine overtime type based on lonnstype field
            const hoursNumber = parseFloat(hours.toString().replace(',', '.'));
            const lonnstype = existingTimer?.lonnstype || '';
            
            if (lonnstype === 'overtid_50') {
              is50Percent = true;
            } else if (lonnstype === 'overtid_100') {
              is50Percent = false;
            } else {
              // Fallback to hours-based logic if lonnstype is not set
              is50Percent = hoursNumber <= 4;
            }
            
          } else if (is_overtime && !overtime_activity_id) {
            console.log('⚠️ Overtime hours but no overtime activity specified - looking for overtime activities');
            
            // Determine overtime type based on lonnstype field
            const hoursNumber = parseFloat(hours.toString().replace(',', '.'));
            const lonnstype = existingTimer?.lonnstype || '';
            
            if (lonnstype === 'overtid_50') {
              is50Percent = true;
            } else if (lonnstype === 'overtid_100') {
              is50Percent = false;
            } else {
              // Fallback to hours-based logic if lonnstype is not set
              is50Percent = hoursNumber <= 4;
            }
            
            const overtimeType = is50Percent ? '50%' : '100%';
            const activityName = `Overtid ${overtimeType}`;
            
            console.log('🔍 Looking for overtime activity:', { 
              overtimeType, 
              activityName, 
              hours: hoursNumber, 
              lonnstype,
              is50Percent 
            });
            
            // Look for existing overtime activities for this project
            const overtimeActivities = await callTripletexAPI(`/activity?project.id=${project_id}&count=1000&fields=id,name`, 'GET', undefined, orgId);
            
            if (overtimeActivities.success && overtimeActivities.data?.values) {
              const activities = overtimeActivities.data.values as Array<{ id: number; name?: string; isActive?: boolean }>;
              
              console.log('Available activities for project:', activities.map(a => ({ id: a.id, name: a.name, isActive: a.isActive })));
              
              // Look for existing overtime activity matching the specific type (50% or 100%)
              const overtimeActivity = activities.find(act => 
                act.isActive !== false && 
                act.name && 
                (act.name.toLowerCase().includes('overtid') || 
                 act.name.toLowerCase().includes('overtime')) &&
                (
                  (overtimeType === '50%' && (
                    act.name.includes('50%') || 
                    act.name.includes('50') || 
                    act.name.toLowerCase().includes('halv')
                  )) ||
                  (overtimeType === '100%' && (
                    act.name.includes('100%') || 
                    act.name.includes('100') || 
                    act.name.toLowerCase().includes('full') ||
                    act.name.toLowerCase().includes('hel')
                  ))
                )
              );
              
              if (overtimeActivity) {
                finalActivityId = overtimeActivity.id;
                console.log('✅ Found existing overtime activity:', { 
                  id: overtimeActivity.id, 
                  name: overtimeActivity.name 
                });
              } else {
                console.log('⚠️ No overtime activity found for this project');
                console.log('Available activities:', activities.map(a => ({ id: a.id, name: a.name, active: a.isActive })));
                
                // Try to find any overtime activity as fallback, then any activity
                const anyOvertimeActivity = activities.find(act => 
                  act.isActive !== false && 
                  act.name && 
                  (act.name.toLowerCase().includes('overtid') || 
                   act.name.toLowerCase().includes('overtime'))
                );
                
                if (anyOvertimeActivity) {
                  console.log('⚠️ Using any overtime activity as fallback:', { 
                    id: anyOvertimeActivity.id, 
                    name: anyOvertimeActivity.name 
                  });
                  finalActivityId = anyOvertimeActivity.id;
                } else {
                  console.log('⚠️ No overtime activities found - attempting to create one');
                  
                  // Try to create an overtime activity for this project
                  const createActivityResponse = await callTripletexAPI('/activity', 'POST', {
                    name: activityName,
                    isActive: true,
                    project: { id: Number(project_id) }
                  }, orgId);
                  
                  if (createActivityResponse.success && createActivityResponse.data?.value?.id) {
                    finalActivityId = createActivityResponse.data.value.id;
                    console.log('✅ Created new overtime activity:', { 
                      id: finalActivityId, 
                      name: activityName 
                    });
                    
                    // Cache the new activity in our database
                    try {
                      await supabase
                        .from('ttx_activity_cache')
                        .upsert({
                          org_id: orgId,
                          ttx_id: finalActivityId,
                          navn: activityName,
                          aktiv: true,
                          last_synced: new Date().toISOString()
                        }, {
                          onConflict: 'org_id,ttx_id',
                          ignoreDuplicates: false
                        });
                      console.log('✅ Cached new overtime activity in database');
                    } catch (cacheError) {
                      console.warn('⚠️ Failed to cache new activity:', cacheError);
                      // Continue anyway - the activity was created in Tripletex
                    }
                  } else {
                    console.log('❌ Could not create overtime activity');
                    return { 
                      success: false, 
                      error: 'Kunne ikke opprette overtidsaktivitet. Overtidstimer kan ikke sendes til samme aktivitet som vanlige timer.',
                      details: 'Failed to create overtime activity in Tripletex'
                    };
                  }
                }
              }
            } else {
              console.log('❌ Could not fetch project activities - this will cause duplicate error');
              return { 
                success: false, 
                error: 'Kunne ikke hente prosjektaktiviteter. Overtidstimer kan ikke sendes uten separat aktivitet.',
                details: 'Contact administrator to check project configuration'
              };
            }
          }

          // 1) Finnes entiteter?
          const employeeCheck = await callTripletexAPI(`/employee/${employee_id}?fields=id,firstName,lastName`, 'GET', undefined, orgId);
          if (!employeeCheck.success) {
            return { success: false, error: 'Tripletex-ID finnes ikke', missing: 'employee', id: employee_id };
          }
          const projectCheck = await callTripletexAPI(`/project/${project_id}?fields=id,number,name`, 'GET', undefined, orgId);
          if (!projectCheck.success) {
            return { success: false, error: 'Tripletex-ID finnes ikke', missing: 'project', id: project_id };
          }
          if (activity_id) {
            const activityCheck = await callTripletexAPI(`/activity/${activity_id}?fields=id,name`, 'GET', undefined, orgId);
            if (!activityCheck.success) {
              return { success: false, error: 'Tripletex-ID finnes ikke', missing: 'activity', id: activity_id };
            }
          }

          // 2) Sørg for deltaker
          console.log('🔍 Checking if employee is participant on project:', { employeeId: employee_id, projectId: project_id });
          const part = await ensureParticipant(orgId, Number(project_id), Number(employee_id));
          if (!part.ok) {
            console.error('❌ Employee not participant:', { employeeId: employee_id, projectId: project_id, reason: part.reason });
            return { success: false, error: 'employee_not_participant', projectId: project_id, employeeId: employee_id, details: part.reason };
          }
          console.log('✅ Employee is participant on project');

          // 3) Sjekk at aktiviteten hører til prosjektet (hvis satt)
          if (finalActivityId) {
            console.log('🔍 Checking if activity exists on project:', { activityId: finalActivityId, projectId: project_id });
            const actOk = await ensureActivityOnProject(orgId, Number(project_id), Number(finalActivityId));
            if (!actOk.ok) {
              console.error('❌ Activity not on project:', { activityId: finalActivityId, projectId: project_id, reason: actOk.reason });
              return { success: false, error: 'activity_not_on_project', projectId: project_id, activityId: finalActivityId, details: actOk.reason };
            }
            console.log('✅ Activity exists on project');
          }

          // Check if there are existing timesheet entries in Tripletex for this combination
          console.log('🔍 Checking for existing timesheet entries in Tripletex...');
          const existingEntriesResponse = await callTripletexAPI(
            `/timesheet/entry?employee.id=${employee_id}&project.id=${project_id}&date=${entryDate}&count=100&fields=id,date,hours,employee,project,activity`, 
            'GET', 
            undefined, 
            orgId
          );

          if (existingEntriesResponse.success && existingEntriesResponse.data?.values?.length > 0) {
            const existingEntries = existingEntriesResponse.data.values as Array<{ id: number; activity?: { id: number } }>;
            const conflictingEntry = existingEntries.find(entry => 
              entry.activity?.id === Number(finalActivityId)
            );

            if (conflictingEntry) {
              console.log('⚠️ Found existing timesheet entry in Tripletex:', { 
                tripletexId: conflictingEntry.id,
                activityId: conflictingEntry.activity?.id,
                employeeId: employee_id,
                projectId: project_id,
                date: entryDate
              });
              return { 
                success: false, 
                error: 'Det finnes allerede timer for denne ansatte, prosjekt og aktivitet på denne dagen i Tripletex. Bruk "Hent tilbake" for å oppdatere eksisterende timer.',
                existingTripletexId: conflictingEntry.id
              };
            }
          }

          console.log('All preflight checks passed - proceeding with timesheet submission');

          // Validate that we have a valid activity ID
          if (!finalActivityId) {
            console.log('❌ No valid activity ID found for timesheet entry');
            return { 
              success: false, 
              error: 'Ingen gyldig aktivitet funnet for denne timeføringen.',
              details: 'Contact administrator to add activities to this project'
            };
          }

          const entryPayload = {
            date: entryDate,
            employee: { id: Number(employee_id) },
            project:  { id: Number(project_id) },
            activity: { id: Number(finalActivityId) },
            hours: hoursNumber,
            comment: description || ''
          };

          console.log('POST /timesheet/entry with payload:', { 
            ...entryPayload, 
            employee: '***', 
            project: '***',
            is_overtime: is_overtime,
            originalActivityId: activity_id,
            finalActivityId: finalActivityId,
            note: is_overtime ? 'Overtime handled through separate activity' : 'Regular hours'
          });

          const response = await callTripletexAPI('/timesheet/entry', 'POST', entryPayload, orgId);

          console.log('Tripletex API response:', { 
            success: response.success, 
            status: response.status,
            hasData: !!response.data,
            isOvertime: is_overtime,
            originalActivityId: activity_id,
            finalActivityId: finalActivityId,
            error: response.error,
            fullResponse: response,
            note: is_overtime ? 'Overtime sent to separate activity for proper billing and payroll' : 'Regular hours processed'
          });

          const createdId = response?.data?.value?.id;
          if (response.success && createdId) {
            console.log('✅ Timesheet entry created successfully:', { tripletexId: createdId });
            
            const { error: updateError } = await supabase
              .from('vakt_timer')
              .update({
                tripletex_entry_id: createdId,
                tripletex_synced_at: new Date().toISOString(),
                sync_error: null,
                status: 'sendt'
              })
              .eq('id', vakt_timer_id);

            if (updateError) {
              console.error('Failed to update vakt_timer after sync:', updateError);
              return { success: true, data: response.data, warning: 'Tripletex ok, men lokal status ikke oppdatert' };
            }

            console.log('✅ Local vakt_timer updated successfully');
            return { success: true, data: { tripletex_id: createdId, message: 'Timesheet entry created' } };
          }

          // Handle failed response
          console.error('❌ Timesheet entry creation failed:', {
            success: response.success,
            error: response.error,
            status: response.status,
            data: response.data
          });

          await supabase
            .from('vakt_timer')
            .update({ 
              sync_error: response.error || 'Unknown error', 
              tripletex_synced_at: null,
              status: 'utkast' // Reset to draft on failure
            })
            .eq('id', vakt_timer_id);

          return response;
        });
        break;
      }

      case 'approve_timesheet_entries': {
        const { entry_ids, approved_by_user_id } = payload;
        
        if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
          result = { success: false, error: 'Missing or invalid entry_ids array' };
          break;
        }

        try {
          const { error: approveError } = await supabase
            .from('vakt_timer')
            .update({
              status: 'godkjent',
              approved_at: new Date().toISOString(),
              approved_by: approved_by_user_id
            })
            .in('id', entry_ids)
            .eq('org_id', orgId);

          if (approveError) {
            result = { success: false, error: `Failed to approve entries: ${approveError.message}` };
          } else {
            result = { 
              success: true, 
              data: { 
                approved_count: entry_ids.length,
                message: `${entry_ids.length} timesheet entries approved`
              } 
            };
          }
        } catch (e: unknown) {
          result = { success: false, error: e instanceof Error ? e.message : 'Failed to approve entries' };
        }
        break;
      }

      case 'unapprove_timesheet_entries': {
        const { entry_ids: unapproveIds } = payload;
        
        if (!unapproveIds || !Array.isArray(unapproveIds) || unapproveIds.length === 0) {
          result = { success: false, error: 'Missing or invalid entry_ids array' };
          break;
        }

        try {
          const { error: unapproveError } = await supabase
            .from('vakt_timer')
            .update({
              status: 'utkast',
              approved_at: null,
              approved_by: null
            })
            .in('id', unapproveIds)
            .eq('org_id', orgId);

          if (unapproveError) {
            result = { success: false, error: `Failed to unapprove entries: ${unapproveError.message}` };
          } else {
            result = { 
              success: true, 
              data: { 
                unapproved_count: unapproveIds.length,
                message: `${unapproveIds.length} timesheet entries set back to draft`
              } 
            };
          }
        } catch (e: unknown) {
          result = { success: false, error: e instanceof Error ? e.message : 'Failed to unapprove entries' };
        }
        break;
      }

      case 'delete_timesheet_entry': {
        const { tripletex_entry_id, vakt_timer_id: deleteVaktTimerId } = payload;
        
        if (!tripletex_entry_id && !deleteVaktTimerId) {
          result = { success: false, error: 'Missing tripletex_entry_id or vakt_timer_id' };
          break;
        }

        result = await exponentialBackoff(async () => {
          let deleteResponse = { success: true };
          
          // Delete from Tripletex if we have the ID
          if (tripletex_entry_id) {
            deleteResponse = await callTripletexAPI(`/timesheet/entry/${tripletex_entry_id}`, 'DELETE', undefined, orgId);
          }

        if (deleteResponse.success && deleteVaktTimerId) {
          // Get original values before restoring
          const { data: originalValues, error: fetchError } = await supabase
            .from('vakt_timer')
            .select('original_timer, original_aktivitet_id, original_notat, original_status')
            .eq('id', deleteVaktTimerId)
            .single();

          if (fetchError) {
            console.error('Failed to fetch original values:', fetchError);
            return { 
              success: true,
              warning: 'Entry deleted from Tripletex but could not restore original values'
            };
          }

          // Update local entry to mark as deleted/reset sync status and restore original values
          const { error: updateError } = await supabase
            .from('vakt_timer')
            .update({
              tripletex_entry_id: null,
              tripletex_synced_at: null,
              sync_error: null,
              status: originalValues?.original_status || 'utkast',
              timer: originalValues?.original_timer || null,
              aktivitet_id: originalValues?.original_aktivitet_id || null,
              notat: originalValues?.original_notat || null
            })
            .eq('id', deleteVaktTimerId);

          if (updateError) {
            console.error('Failed to update local entry after Tripletex deletion:', updateError);
            return { 
              success: true,
              warning: 'Entry deleted from Tripletex but local status not updated'
            };
          }
        }

          return deleteResponse.success 
            ? { success: true, data: { message: 'Timesheet entry deleted successfully' } }
            : deleteResponse;
        });
        break;
      }

      case 'get_project_details': {
        const projectId = payload?.project_id;
        
        if (!projectId) {
          return new Response(JSON.stringify({ error: 'Missing project_id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        result = await exponentialBackoff(async () => {
          // Get project details
          const projectResponse = await callTripletexAPI(`/project/${projectId}?fields=id,number,name,displayName,customer,department,projectManager`, 'GET', undefined, orgId);
          
          if (!projectResponse.success) {
            return { success: false, error: 'Failed to fetch project details from Tripletex' };
          }

          const project = projectResponse.data?.value;
          if (!project) {
            return { success: false, error: 'Project not found' };
          }

          // Get customer details if available
          let customerDetails = null;
          if (project.customer?.id) {
            const customerResponse = await callTripletexAPI(`/customer/${project.customer.id}?fields=id,name`, 'GET', undefined, orgId);
            if (customerResponse.success) {
              customerDetails = customerResponse.data?.value;
            }
          }

          // Get project manager details if available
          let projectManagerDetails = null;
          if (project.projectManager?.id) {
            const managerResponse = await callTripletexAPI(`/employee/${project.projectManager.id}?fields=id,firstName,lastName,email`, 'GET', undefined, orgId);
            if (managerResponse.success) {
              projectManagerDetails = managerResponse.data?.value;
            }
          }

          // Get department details if available
          let departmentDetails = null;
          if (project.department?.id) {
            const deptResponse = await callTripletexAPI(`/department/${project.department.id}?fields=id,name`, 'GET', undefined, orgId);
            if (deptResponse.success) {
              departmentDetails = deptResponse.data?.value;
            }
          }

          // Format response
          const projectDetails = {
            id: project.id,
            name: project.name,
            number: project.number,
            description: project.description,
            startDate: project.startDate,
            endDate: project.endDate,
            customer: {
              name: customerDetails?.name || project.customer?.name || 'Ukjent kunde',
              email: customerDetails?.email,
              phoneNumber: customerDetails?.phoneNumber
            },
            projectManager: projectManagerDetails ? {
              firstName: projectManagerDetails.firstName,
              lastName: projectManagerDetails.lastName,
              email: projectManagerDetails.email,
              phoneNumber: projectManagerDetails.phoneNumber
            } : null,
            department: departmentDetails ? {
              name: departmentDetails.name
            } : null,
            isClosed: project.isClosed || false,
            displayName: project.displayName || `${project.number} - ${project.name}`
          };

          return { success: true, data: projectDetails };
        });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in tripletex-api function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
