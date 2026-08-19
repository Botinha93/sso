import { ValidationError } from "../core/errors.js";
import type { Suggestion, SuggestionKind, SuggestionStatus, User } from "../domain/models.js";
import { SUGGESTION_KINDS, SUGGESTION_STATUSES } from "../domain/models.js";
import type { AppRepository, AuditRepository, SuggestionRepository, UserRepository } from "../repositories/contracts.js";
import type { UserService } from "./user-service.js";

export interface SuggestionAuthorDto {
  id: string;
  email: string;
  username: string;
  givenName: string;
  familyName: string;
}

export interface SuggestionDto {
  id: string;
  kind: SuggestionKind;
  appId?: string;
  appName?: string;
  proposedName?: string;
  title: string;
  body: string;
  imageUrls: string[];
  status: SuggestionStatus;
  createdAt: string;
  updatedAt: string;
  internalNotes?: string;
  author?: SuggestionAuthorDto;
}

export const canRevealSuggestionAuthor = (permissions: string[]) => permissions.includes("*:*");

const isSuggestionKind = (value: string): value is SuggestionKind =>
  (SUGGESTION_KINDS as readonly string[]).includes(value);

const isSuggestionStatus = (value: string): value is SuggestionStatus =>
  (SUGGESTION_STATUSES as readonly string[]).includes(value);

const authorFromUser = (user: User): SuggestionAuthorDto => ({
  id: user.id,
  email: user.email,
  username: user.username,
  givenName: user.givenName,
  familyName: user.familyName
});

export const toSuggestionDto = (
  suggestion: Suggestion,
  options: {
    revealAuthor: boolean;
    includeInternalNotes: boolean;
    author?: User;
    appName?: string;
  }
): SuggestionDto => {
  const dto: SuggestionDto = {
    id: suggestion.id,
    kind: suggestion.kind,
    appId: suggestion.appId,
    appName: options.appName,
    proposedName: suggestion.proposedName,
    title: suggestion.title,
    body: suggestion.body,
    imageUrls: suggestion.imageUrls,
    status: suggestion.status,
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString()
  };

  if (options.includeInternalNotes && suggestion.internalNotes) {
    dto.internalNotes = suggestion.internalNotes;
  }

  if (options.revealAuthor && options.author) {
    dto.author = authorFromUser(options.author);
  }

  return dto;
};

export class SuggestionService {
  constructor(
    private readonly suggestionRepository: SuggestionRepository,
    private readonly userRepository: UserRepository,
    private readonly appRepository: AppRepository,
    private readonly userService: UserService,
    private readonly auditRepository: AuditRepository
  ) {}

  private async userCanAccessApp(userId: string, appId: string) {
    const access = await this.userService.resolveAppAccessForUser(userId);
    return access.appIds.length === 0 || access.appIds.includes(appId);
  }

  private async toDto(
    suggestion: Suggestion,
    options: { revealAuthor: boolean; includeInternalNotes: boolean }
  ): Promise<SuggestionDto> {
    const app = suggestion.appId ? await this.appRepository.findById(suggestion.appId) : undefined;
    const author = options.revealAuthor
      ? await this.userRepository.findById(suggestion.authorUserId)
      : undefined;
    return toSuggestionDto(suggestion, {
      ...options,
      author,
      appName: app?.name
    });
  }

  async createForUser(input: {
    authorUserId: string;
    kind: string;
    appId?: string;
    proposedName?: string;
    title: string;
    body: string;
    imageUrls?: string[];
  }): Promise<SuggestionDto> {
    if (!isSuggestionKind(input.kind)) {
      throw new ValidationError("Invalid suggestion kind");
    }

    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) {
      throw new ValidationError("Title and body are required");
    }

    const imageUrls = (input.imageUrls ?? []).filter((url) => typeof url === "string" && url.startsWith("/media/uploads/suggestions/"));

    if (input.kind === "existing_app") {
      if (!input.appId) {
        throw new ValidationError("App is required for existing-app suggestions");
      }
      const app = await this.appRepository.findById(input.appId);
      if (!app) {
        throw new ValidationError("App not found");
      }
      if (!await this.userCanAccessApp(input.authorUserId, input.appId)) {
        throw new ValidationError("You do not have access to that app");
      }
    }

    const suggestion = await this.suggestionRepository.create({
      kind: input.kind,
      appId: input.kind === "existing_app" ? input.appId : undefined,
      proposedName: input.kind === "new_system" ? input.proposedName?.trim() || undefined : undefined,
      title,
      body,
      imageUrls,
      authorUserId: input.authorUserId,
      status: "open"
    });

    await this.auditRepository.log({
      type: "suggestion_created",
      actorType: "system",
      metadata: {
        suggestionId: suggestion.id,
        kind: suggestion.kind,
        appId: suggestion.appId,
        status: suggestion.status
      }
    });

    return this.toDto(suggestion, { revealAuthor: false, includeInternalNotes: false });
  }

  async listForUser(authorUserId: string): Promise<SuggestionDto[]> {
    const items = await this.suggestionRepository.listByAuthor(authorUserId);
    return Promise.all(items.map((item) => this.toDto(item, { revealAuthor: false, includeInternalNotes: false })));
  }

  async listForAdmin(options: { revealAuthor: boolean }): Promise<SuggestionDto[]> {
    const items = await this.suggestionRepository.list();
    return Promise.all(items.map((item) => this.toDto(item, {
      revealAuthor: options.revealAuthor,
      includeInternalNotes: true
    })));
  }

  async getForAdmin(id: string, options: { revealAuthor: boolean }): Promise<SuggestionDto | undefined> {
    const suggestion = await this.suggestionRepository.findById(id);
    if (!suggestion) return undefined;
    return this.toDto(suggestion, {
      revealAuthor: options.revealAuthor,
      includeInternalNotes: true
    });
  }

  async updateForAdmin(input: {
    id: string;
    actorUserId: string;
    revealAuthor: boolean;
    status?: string;
    internalNotes?: string | null;
  }): Promise<SuggestionDto | undefined> {
    const existing = await this.suggestionRepository.findById(input.id);
    if (!existing) return undefined;

    const patch: Partial<Omit<Suggestion, "id" | "createdAt" | "authorUserId">> = {};
    if (input.status !== undefined) {
      if (!isSuggestionStatus(input.status)) {
        throw new ValidationError("Invalid suggestion status");
      }
      patch.status = input.status;
    }
    if (input.internalNotes !== undefined) {
      patch.internalNotes = input.internalNotes?.trim() || undefined;
    }

    const updated = await this.suggestionRepository.update(input.id, patch);
    if (!updated) return undefined;

    await this.auditRepository.log({
      type: "suggestion_updated",
      actorType: "user",
      actorId: input.actorUserId,
      metadata: {
        suggestionId: updated.id,
        status: updated.status
      }
    });

    return this.toDto(updated, { revealAuthor: input.revealAuthor, includeInternalNotes: true });
  }
}
