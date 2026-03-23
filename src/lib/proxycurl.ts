export interface ProxycurlCredentials {
  apiKey: string;
}

export interface LinkedInProfile {
  public_identifier: string;
  first_name: string;
  last_name: string;
  full_name: string;
  headline: string;
  occupation: string;
  summary: string;
  country: string;
  city: string;
  experiences: Experience[];
  education: Education[];
}

export interface Experience {
  starts_at: { day?: number; month?: number; year: number } | null;
  ends_at: { day?: number; month?: number; year: number } | null;
  company: string;
  company_linkedin_profile_url: string;
  title: string;
  description: string;
  location: string;
}

export interface Education {
  starts_at: { day?: number; month?: number; year: number } | null;
  ends_at: { day?: number; month?: number; year: number } | null;
  school: string;
  degree_name: string;
  field_of_study: string;
}

export interface JobChange {
  previousCompany: string;
  previousTitle: string;
  currentCompany: string;
  currentTitle: string;
}

/**
 * Fetch LinkedIn profile data using Proxycurl
 */
export async function enrichLinkedInProfile(
  apiKey: string,
  linkedinUrl: string
): Promise<LinkedInProfile | null> {
  try {
    const response = await fetch(
      `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}&use_cache=if-present`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`LinkedIn profile not found: ${linkedinUrl}`);
        return null;
      }
      if (response.status === 401) {
        throw new Error("Invalid Proxycurl API key");
      }
      throw new Error(`Proxycurl API error: ${response.status}`);
    }

    const data = await response.json();
    return data as LinkedInProfile;
  } catch (error) {
    console.error("Proxycurl enrichment failed:", error);
    throw error;
  }
}

/**
 * Detect job change by comparing stored profile with current profile
 */
export async function detectJobChange(
  apiKey: string,
  linkedinUrl: string,
  previousCompany?: string,
  previousTitle?: string
): Promise<JobChange | null> {
  if (!linkedinUrl) {
    return null;
  }

  try {
    const profile = await enrichLinkedInProfile(apiKey, linkedinUrl);
    if (!profile) {
      return null;
    }

    // Get current position (most recent experience without end date)
    const currentExp = profile.experiences?.find((exp) => !exp.ends_at);
    if (!currentExp) {
      return null;
    }

    // If we have previous data, check for change
    if (previousCompany && previousTitle) {
      const companyChanged =
        currentExp.company.toLowerCase() !== previousCompany.toLowerCase();
      const titleChanged =
        currentExp.title.toLowerCase() !== previousTitle.toLowerCase();

      if (companyChanged || titleChanged) {
        return {
          previousCompany,
          previousTitle,
          currentCompany: currentExp.company,
          currentTitle: currentExp.title,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Job change detection failed:", error);
    return null;
  }
}

/**
 * Check Proxycurl credit balance
 */
export async function checkCreditBalance(apiKey: string): Promise<number> {
  const response = await fetch("https://nubela.co/proxycurl/api/credit-balance", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Proxycurl API error: ${response.status}`);
  }

  const data = await response.json();
  return data.credit_balance || 0;
}
