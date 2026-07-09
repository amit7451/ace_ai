import { PromptTemplateError } from '../errors/prompt.errors';

/**
 * Validates and compiles a template string.
 * Ensures that required variables (like `{context}`) are actually present in the template.
 */
export function compileTemplate(template: string, variables: Record<string, string>): string {
  let compiled = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    
    // We strictly enforce that the required placeholders exist in the template
    if (!template.includes(placeholder)) {
      throw new PromptTemplateError(template, key);
    }
    
    compiled = compiled.replace(placeholder, value);
  }

  return compiled;
}
