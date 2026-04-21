import { Buffer } from "node:buffer";
import type { FastifyInstance } from "fastify";
import type { AuditRepository } from "../repositories/contracts.js";
import type { SamlServiceProviderRepository } from "../repositories/contracts.js";
import type { SamlService } from "../services/saml-service.js";
import type { AuthService } from "../services/auth-service.js";
import type { SamlSignatureService } from "../services/saml-signature-service.js";
import type { UserService } from "../services/user-service.js";
import { AppError, ValidationError } from "../core/errors.js";
import type { SamlReplayProtectionService } from "../services/saml-replay-protection-service.js";
import {
  samlAcsSchema,
  samlMetadataSchema,
  samlSloSchema,
  samlSsoSchema
} from "./saml-schemas.js";
import { validateSamlAssertionSecurity, validateSamlAssertionStructure } from "./saml-assertion-validation.js";
import {
  createUnsignedSamlResponse,
  decodeSamlResponse,
  parseSamlAssertion
} from "./samllib.js";

interface SamlProtocolRouteDeps {
  samlService: SamlService;
  samlServiceProviderRepository: SamlServiceProviderRepository;
  authService: AuthService;
  userService: UserService;
  auditRepository: AuditRepository;
  samlReplayProtectionService: SamlReplayProtectionService;
  samlSignatureService: SamlSignatureService;
}

const htmlForm = (input: { action: string; fields: Array<{ name: string; value: string }> }) => {
  const hiddenFields = input.fields
    .map((field) => `<input type="hidden" name="${field.name}" value="${field.value}">`)
    .join("\n");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>SAML Response</title>
  </head>
  <body onload="document.forms[0].submit()">
    <form method="POST" action="${input.action}">
      ${hiddenFields}
      <noscript>
        <button type="submit">Continue</button>
      </noscript>
    </form>
  </body>
</html>`;
};

const getSessionUser = async (request: any, deps: SamlProtocolRouteDeps) => {
  const sid = request.cookies?.sid;
  if (!sid) {
    return undefined;
  }

  const session = await deps.authService.sessionRepository.findById(sid);
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return undefined;
  }

  return deps.userService.findUserById(session.userId);
};

const sanitizeAuditError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown assertion validation error";
};

const publicSamlProtocolError = () => "SAML request could not be completed";

export const registerSamlProtocolRoutes = async (app: FastifyInstance, deps: SamlProtocolRouteDeps) => {
  app.get("/saml/metadata", async (request, reply) => {
    const query = samlMetadataSchema.parse(request.query);
    const metadata = await deps.samlService.generateMetadata(query.spId);
    return reply.type("application/samlmetadata+xml").send(metadata);
  });

  app.post("/saml/sso", async (request, reply) => {
    const input = samlSsoSchema.parse(request.body);
    const sp = await deps.samlServiceProviderRepository.findById(input.spId);
    if (!sp || !sp.enabled) {
      throw new ValidationError("Service provider not found or disabled");
    }

    let user = await getSessionUser(request, deps);
    if (!user && input.userId) {
      user = await deps.userService.findUserById(input.userId);
    }
    if (!user) {
      return reply.status(401).send({ error: "unauthorized" });
    }

    const unsignedResponse = createUnsignedSamlResponse({
      issuer: "northstar:sso:idp",
      audience: sp.entityId,
      destinationUrl: sp.acsUrl,
      subject: user.email,
      inResponseTo: input.requestId,
      nameIdFormat: sp.nameIdFormat,
      relayState: input.relayState
    });

    const samlResponse = deps.samlSignatureService.signResponseXml(unsignedResponse.xml);

    await deps.samlService.recordAssertionAudit({
      spId: sp.id,
      requestId: input.requestId ?? `generated-${unsignedResponse.responseId}`,
      responseId: unsignedResponse.responseId,
      subject: user.email,
      audience: sp.entityId,
      assertionId: unsignedResponse.assertionId,
      issueInstant: unsignedResponse.issueInstant,
      notOnOrAfter: unsignedResponse.notOnOrAfter,
      destinationUrl: sp.acsUrl,
      statusCode: "urn:oasis:names:tc:SAML:2.0:status:Success"
    });

    await deps.auditRepository.log({
      type: "saml_sso_succeeded",
      actorId: user.id,
      actorType: "user",
      ip: request.ip,
      metadata: {
        spId: sp.id,
        entityId: sp.entityId,
        responseId: unsignedResponse.responseId,
        signatureKeyId: samlResponse.keyId
      }
    });

    if (input.responseMode === "json") {
      return reply.status(200).send({
        destination: sp.acsUrl,
        samlResponse: Buffer.from(samlResponse.xml, "utf-8").toString("base64"),
        relayState: input.relayState ?? null
      });
    }

    const form = htmlForm({
      action: sp.acsUrl,
      fields: [
        { name: "SAMLResponse", value: Buffer.from(samlResponse.xml, "utf-8").toString("base64") },
        ...(input.relayState ? [{ name: "RelayState", value: input.relayState }] : [])
      ]
    });

    return reply.type("text/html; charset=utf-8").send(form);
  });

  app.post("/saml/acs/:spId", async (request, reply) => {
    const { spId } = request.params as { spId: string };
    const body = samlAcsSchema.parse(request.body);
    const sp = await deps.samlServiceProviderRepository.findById(spId);

    if (!sp) {
      return reply.status(404).send({ error: "Service provider not found" });
    }

    let parsed = undefined as ReturnType<typeof parseSamlAssertion> | undefined;

    try {
      const signedXml = decodeSamlResponse(body.SAMLResponse);
      const signatureCheck = deps.samlSignatureService.verifyResponseXml(signedXml);
      if (!signatureCheck.valid || !signatureCheck.unsignedXml) {
        throw new ValidationError(signatureCheck.reason ?? "Invalid SAML response signature");
      }

      validateSamlAssertionStructure(signatureCheck.unsignedXml);

      parsed = parseSamlAssertion(signatureCheck.unsignedXml);

      validateSamlAssertionSecurity({
        assertion: parsed,
        expectedAudience: sp.entityId,
        expectedDestination: sp.acsUrl
      });

      if (!deps.samlReplayProtectionService.reserve(parsed.responseId!, parsed.notOnOrAfter)) {
        throw new ValidationError("SAML response replay detected");
      }

      await deps.samlService.recordAssertionAudit({
        spId,
        requestId: parsed.requestId ?? "unknown-request",
        responseId: parsed.responseId ?? `response-${Date.now()}`,
        subject: parsed.subject ?? "unknown-subject",
        audience: parsed.audience ?? sp.entityId,
        assertionId: parsed.assertionId ?? `assertion-${Date.now()}`,
        issueInstant: parsed.issueInstant ?? new Date(),
        notOnOrAfter: parsed.notOnOrAfter ?? new Date(Date.now() + (5 * 60 * 1000)),
        destinationUrl: parsed.destinationUrl ?? sp.acsUrl,
        statusCode: parsed.statusCode ?? "urn:oasis:names:tc:SAML:2.0:status:Success"
      });

      await deps.auditRepository.log({
        type: "saml_assertion_validated",
        actorType: "system",
        ip: request.ip,
        metadata: {
          spId,
          relayState: body.RelayState,
          responseId: parsed.responseId,
          assertionId: parsed.assertionId
        }
      });

      return reply.status(200).send({
        ok: true,
        spId,
        relayState: body.RelayState ?? null,
        subject: parsed.subject ?? null,
        statusCode: parsed.statusCode ?? null
      });
    } catch (error) {
      await deps.auditRepository.log({
        type: "saml_assertion_invalid",
        actorType: "system",
        ip: request.ip,
        metadata: {
          spId,
          relayState: body.RelayState,
          error: sanitizeAuditError(error),
          responseId: parsed?.responseId,
          assertionId: parsed?.assertionId
        }
      });

      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: publicSamlProtocolError() });
      }

      return reply.status(400).send({ error: publicSamlProtocolError() });
    }
  });

  app.post("/saml/slo", async (request, reply) => {
    const body = samlSloSchema.parse(request.body);
    const sid = body.sessionId ?? request.cookies?.sid;

    if (sid) {
      await deps.authService.sessionRepository.revoke(sid, new Date());
    }

    reply.clearCookie("sid", {
      path: "/"
    });

    await deps.auditRepository.log({
      type: "saml_slo_initiated",
      actorType: "system",
      ip: request.ip,
      metadata: {
        sessionId: sid,
        reason: body.reason,
        relayState: body.relayState
      }
    });

    return reply.status(200).send({
      ok: true,
      sessionRevoked: Boolean(sid),
      relayState: body.relayState ?? null
    });
  });
};
