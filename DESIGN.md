# Inspector Management

## Mission

Create implementation-ready, token-driven UI guidance for Inspector Management that is optimized for consistency, accessibility, and fast delivery across e-commerce storefront.

## Brand

- Product/brand: Inspector Management
- URL: https://dautoeic.com/vocabulary
- Audience: online shoppers and consumers
- Product surface: e-commerce storefront

## Style Foundations

- Visual style: structured, tokenized, content-first
- Main font style: `font.family.primary=Inter`, `font.family.stack=Inter, system-ui, sans-serif`, `font.size.base=14px`, `font.weight.base=500`, `font.lineHeight.base=20px`
- Typography scale: `font.size.xs=14px`, `font.size.sm=16px`, `font.size.md=18px`, `font.size.lg=20px`, `font.size.xl=36px`
- Color palette: `color.text.primary=#f8fafc`, `color.text.secondary=#97a3b4`, `color.text.tertiary=#059669`, `color.surface.strong=#26b2f2`, `color.surface.base=#000000`, `color.surface.muted=#0f131a`, `color.surface.raised=#161d27`, `color.border.default=#29313d`, `color.border.muted=#065f46`
- Spacing scale: `space.1=2px`, `space.2=8px`, `space.3=12px`, `space.4=16px`, `space.5=20px`, `space.6=24px`, `space.7=32px`
- Radius/shadow/motion tokens: `radius.xs=10px`, `radius.sm=12px`, `radius.md=9999px` | `shadow.1=rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`, `shadow.2=rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px`, `shadow.3=rgb(15, 19, 26) 0px 0px 0px 1px, rgba(38, 178, 242, 0.3) 0px 0px 0px 3px, rgba(38, 178, 242, 0.3) 0px 0px 8px 2px` | `motion.duration.instant=150ms`

## Accessibility

- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone

Concise, confident, implementation-focused.

## Rules: Do

- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't

- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow

1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure

- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations

- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: buttons (72), cards (50), navigation (2), links (1), lists (1).

## Quality Gates

- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.
