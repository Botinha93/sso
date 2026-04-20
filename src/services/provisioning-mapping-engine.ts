import type { ProvisioningMapping } from "../domain/models.js";

const CUSTOM_ATTRIBUTES_PREFIX = "customAttributes.";

const isLowercaseTransform = (expression: string) =>
  expression === "lowercase" || expression === "value?.toLowerCase()" || expression === "value.toLowerCase()";

const isUppercaseTransform = (expression: string) =>
  expression === "uppercase" || expression === "value?.toUpperCase()" || expression === "value.toUpperCase()";

const isTrimTransform = (expression: string) =>
  expression === "trim" || expression === "value?.trim()" || expression === "value.trim()";

const applyTransformExpression = (rawValue: string, transformExpression: string | undefined) => {
  if (!transformExpression) {
    return rawValue;
  }

  const normalized = transformExpression.trim();
  if (!normalized) {
    return rawValue;
  }

  if (isLowercaseTransform(normalized)) {
    return rawValue.toLowerCase();
  }
  if (isUppercaseTransform(normalized)) {
    return rawValue.toUpperCase();
  }
  if (isTrimTransform(normalized)) {
    return rawValue.trim();
  }

  const pipeline = normalized.split("|").map((item) => item.trim()).filter(Boolean);
  if (pipeline.length > 1) {
    return pipeline.reduce((value, step) => applyTransformExpression(value, step), rawValue);
  }

  return rawValue;
};

const resolveSourceAttributeValue = (attributes: Record<string, string>, sourceAttribute: string): string | undefined => {
  if (sourceAttribute in attributes) {
    return attributes[sourceAttribute];
  }

  return undefined;
};

const normalizeTargetAttribute = (targetAttribute: string) => {
  if (targetAttribute.startsWith(CUSTOM_ATTRIBUTES_PREFIX)) {
    return targetAttribute.slice(CUSTOM_ATTRIBUTES_PREFIX.length);
  }
  return targetAttribute;
};

export interface ProvisioningMappingDrift {
  mappingId: string;
  targetAttribute: string;
  currentValue: string | undefined;
  expectedValue: string;
}

export interface ProvisioningMappingEvaluation {
  nextCustomAttributes: Record<string, string>;
  drift: ProvisioningMappingDrift[];
}

export const evaluateProvisioningMappings = (input: {
  customAttributes: Record<string, string>;
  mappings: ProvisioningMapping[];
}): ProvisioningMappingEvaluation => {
  const nextCustomAttributes = { ...input.customAttributes };
  const drift: ProvisioningMappingDrift[] = [];

  for (const mapping of input.mappings) {
    if (!mapping.enabled) {
      continue;
    }

    const sourceValue = resolveSourceAttributeValue(nextCustomAttributes, mapping.sourceAttribute);
    if (sourceValue === undefined) {
      continue;
    }

    const expectedValue = applyTransformExpression(sourceValue, mapping.transformExpression);
    const targetAttribute = normalizeTargetAttribute(mapping.targetAttribute);
    const currentValue = nextCustomAttributes[targetAttribute];

    if (currentValue !== expectedValue) {
      drift.push({
        mappingId: mapping.id,
        targetAttribute,
        currentValue,
        expectedValue
      });
      nextCustomAttributes[targetAttribute] = expectedValue;
    }
  }

  return { nextCustomAttributes, drift };
};