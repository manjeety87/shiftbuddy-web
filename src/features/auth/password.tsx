// The same three rules the backend enforces, shown while typing so the first
// submit doesn't come back with a list.
const RULES = [
  { label: "8 or more characters", test: (value: string) => value.length >= 8 },
  { label: "An uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "A number", test: (value: string) => /[0-9]/.test(value) },
];

export const isStrongPassword = (value: string) => RULES.every((rule) => rule.test(value));

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="-mt-2 mb-5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.label} className={`transition-colors duration-150 ${met ? "text-success" : "text-muted-foreground"}`}>
            <span aria-hidden>{met ? "✓ " : "· "}</span>
            {rule.label}
            <span className="sr-only">{met ? " (done)" : " (needed)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
