export type ManagedClientProfileBinding = {
  profileId: "nexushub" | "liberide";
  profileVersion: 1;
  installationId: string;
};

/** Managed NexusHub credentials may only be used through the consent-bound profile. */
export function managedNexusHubExchangeBindingMismatch(
  managedProfile: ManagedClientProfileBinding | undefined,
  request: { profileId?: string; profileVersion?: number; installationId?: string }
): boolean {
  return managedProfile?.profileId === "nexushub" && (
    request.profileId !== "nexushub" ||
    request.profileVersion !== managedProfile.profileVersion ||
    request.installationId !== managedProfile.installationId
  );
}
