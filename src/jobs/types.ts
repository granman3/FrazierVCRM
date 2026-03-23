export interface ContactsSyncJob {
  tenantId: string;
  sourceType: "carddav" | "google_contacts" | "csv";
  fullSync?: boolean;
}

export interface VipClassifierJob {
  tenantId: string;
  incrementalOnly?: boolean;
}

export interface ChiefOfStaffJob {
  tenantId: string;
}

export interface HealthCheckJob {
  tenantId: string;
  integrationType: "carddav" | "google_contacts" | "proxycurl";
}

export type JobData =
  | ContactsSyncJob
  | VipClassifierJob
  | ChiefOfStaffJob
  | HealthCheckJob;
