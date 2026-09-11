export function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      [
        `Missing required environment variable: ${name}.`,
        "",
        "  Run `npm run check-env` from the repo root to see everything that's missing,",
        "  `npm run channel:setup` to configure Slack or Teams,",
        "  or `npm run dev:web` to try the browser template instead.",
      ].join("\n"),
    );
  }
  return value;
}
