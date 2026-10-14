export interface TotpStatus {
  enabled: boolean;
}

export interface TotpEnrollmentStart {
  enrollmentId: string;
  secret: string;
  otpauthUri: string;
  expiresIn: number;
}

export interface VerifyTotpEnrollmentInput {
  enrollmentId: string;
  code: string;
}

export interface TotpEnrollmentComplete {
  enabled: true;
}

export interface WebauthnCredentialSummary {
  credentialId: string;
  transports: string[];
  aaguid?: string;
  signCount: number;
  createdAt: string;
}

export interface WebauthnRegisterBeginInput {
  displayName?: string;
}

export interface WebauthnRegisterBeginResult {
  registrationId: string;
  challenge: string;
  rpId: string;
  rpName: string;
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{ type: string; alg: number }>;
  timeout?: number;
  attestation?: string;
  authenticatorSelection?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WebauthnRegisterFinishInput {
  registrationId: string;
  credentialId: string;
  publicKey: string;
  transports?: string[];
  aaguid?: string;
  signCount?: number;
}

export interface WebauthnRegisterFinishResult {
  credentialId: string;
  transports: string[];
  signCount: number;
  createdAt: string;
}

export interface AccountAPI {
  getTotp(): Promise<TotpStatus>;
  enrollTotp(): Promise<TotpEnrollmentStart>;
  verifyTotp(input: VerifyTotpEnrollmentInput): Promise<TotpEnrollmentComplete>;
  disableTotp(): Promise<void>;
  listWebauthnCredentials(): Promise<WebauthnCredentialSummary[]>;
  beginWebauthnRegistration(input?: WebauthnRegisterBeginInput): Promise<WebauthnRegisterBeginResult>;
  finishWebauthnRegistration(input: WebauthnRegisterFinishInput): Promise<WebauthnRegisterFinishResult>;
  removeWebauthnCredential(credentialId: string): Promise<void>;
}
