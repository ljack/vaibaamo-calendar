---
trigger: glob
globs: *.ts
---

# Rule: No `any` in TypeScript (Prohibited)

## Summary

Using `any` is forbidden in this codebase.

## Why

`any` disables type checking, hides bugs, and makes refactoring unsafe. If you
don’t know the type yet, model the uncertainty explicitly instead of opting out
of the type system.

## Rule

- **DO NOT** write `any` anywhere (including `any[]`, `Promise<any>`,
  `Record<string, any>`, type assertions like `as any`, etc.).
- **DO NOT** rely on implicit `any` (missing parameter/return types that default
  to `any`).

## What to use instead

- Prefer precise types (interfaces, unions, generics).
- For unknown external data (e.g., JSON), use:
  - `unknown` + runtime validation (type guards / schema validation)
- For key/value objects:
  - `Record<string, unknown>` (or a specific value type)
- For “some function”:
  - `(...args: unknown[]) => unknown` (or a specific signature)
- For “some array”:
  - `unknown[]` (or a specific element type)

## Enforcement

### TypeScript (prevents implicit `any`)

In `tsconfig.json`:

```json
{
    "compilerOptions": {
        "strict": true,
        "noImplicitAny": true
    }
}
```
