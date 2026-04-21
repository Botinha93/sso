import { createSign, createVerify, generateKeyPairSync } from "node:crypto";
import { attachSamlSignature, extractSamlSignature } from "../http/samllib.js";

export interface SamlSignedResponse {
  keyId: string;
  xml: string;
  signature: string;
}

export interface SamlSignatureVerificationResult {
  valid: boolean;
  unsignedXml?: string;
  keyId?: string;
  reason?: string;
}

export class SamlSignatureService {
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor(private readonly keyId = "saml-default-rs256") {
    const generated = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem"
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem"
      }
    });

    this.privateKey = generated.privateKey;
    this.publicKey = generated.publicKey;
  }

  signResponseXml(xml: string): SamlSignedResponse {
    const signer = createSign("RSA-SHA256");
    signer.update(xml);
    signer.end();
    const signature = signer.sign(this.privateKey, "base64");

    return {
      keyId: this.keyId,
      signature,
      xml: attachSamlSignature({
        xml,
        signature,
        keyId: this.keyId
      })
    };
  }

  verifyResponseXml(xml: string): SamlSignatureVerificationResult {
    const extracted = extractSamlSignature(xml);
    if (!extracted) {
      return {
        valid: false,
        reason: "Missing SAML response signature"
      };
    }

    const verifier = createVerify("RSA-SHA256");
    verifier.update(extracted.unsignedXml);
    verifier.end();

    const valid = verifier.verify(this.publicKey, extracted.signature, "base64");
    if (!valid) {
      return {
        valid: false,
        reason: "Invalid SAML response signature",
        keyId: extracted.keyId
      };
    }

    return {
      valid: true,
      keyId: extracted.keyId,
      unsignedXml: extracted.unsignedXml
    };
  }
}
