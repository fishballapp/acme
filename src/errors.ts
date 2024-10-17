const setupError = (error: Error) => {
  error.name = error.constructor.name;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(error, error.constructor);
  }
};
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    setupError(this);
  }
}

export const ACME_ERROR_TYPES = {
  BAD_NONCE: "urn:ietf:params:acme:error:badNonce",
  ACCOUNT_DOES_NOT_EXIST: "urn:ietf:params:acme:error:accountDoesNotExist",
} as const;

export type AcmeRawError<T extends string = string> = {
  type: T;
  detail: string;
  status: number;
};

/** Represents any error from the ACME server */
export class AcmeError<T extends string = string> extends Error {
  override cause: AcmeRawError<T>;

  constructor(cause: AcmeRawError<T>) {
    super(`ACME Server Error: ${cause.detail}`);
    setupError(this);
    this.cause = cause;
  }
}

/**
 * Bad Nonce error from ACME server.
 *
 * The client automatically retry Bad Nonce error for up to 5 times.
 * On the 5th attempt, it will throw this error if it still fails due
 * to Bad Nonce Error.
 */
export class BadNonceError
  extends AcmeError<typeof ACME_ERROR_TYPES["BAD_NONCE"]> {}

/** "Account Does Not Exist" error from ACME server. */
export class AccountDoesNotExistError
  extends AcmeError<typeof ACME_ERROR_TYPES["ACCOUNT_DOES_NOT_EXIST"]> {}
