/** A request the caller can fix; `status` is the HTTP status the API should use. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
