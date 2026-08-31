// Shared link submission logic for both frontend and bookmarklet

export interface SubmitLinkParams {
  url: string;
  title: string;
  tags: string;
  notes: string;
  username: string;
  password: string;
  origin?: string;
}

export interface SubmitLinkResult {
  success: boolean;
  error?: string;
}

async function postIssue(payload: Record<string, unknown>, origin: string): Promise<SubmitLinkResult> {
  try {
    const response = await fetch(`${origin}/.netlify/functions/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    return response.ok ? { success: true } : { success: false, error: result.error || 'Failed' };
  } catch (e) {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Submit a link to the trove backend
 */
export async function submitLink(params: SubmitLinkParams): Promise<SubmitLinkResult> {
  const { url, title, tags, notes, username, password, origin = '' } = params;

  if (!username || !password) {
    return { success: false, error: 'Enter credentials' };
  }

  if (!url) {
    return { success: false, error: 'Enter a URL' };
  }

  return postIssue({ url, title: title || undefined, tags, notes, username, password }, origin);
}

/**
 * File a bookmarklet problem report against the page the user is on
 */
export async function reportProblem(params: SubmitLinkParams): Promise<SubmitLinkResult> {
  const { url, title, notes, username, password, origin = '' } = params;

  if (!username || !password) {
    return { success: false, error: 'Enter credentials' };
  }

  return postIssue({ action: 'report', url, title, notes, username, password }, origin);
}
