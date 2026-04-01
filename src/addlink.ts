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

  try {
    const endpoint = origin ? `${origin}/.netlify/functions/submit` : '/.netlify/functions/submit';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title: title || undefined, tags, notes, username, password }),
    });

    const result = await response.json();

    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Failed' };
    }
  } catch (e) {
    return { success: false, error: 'Network error' };
  }
}
