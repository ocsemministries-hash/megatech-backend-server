export type ErrorPayload = { success: boolean; error: string };

export const httpError = {
  statusCode: 422,
  message: 'Validation failed',
};

export const plainError = Object.assign(new Error('Database connection lost'), {
  stack: 'Error: Database connection lost\n    at test:1:1',
});

export const serverError = Object.assign(new Error('Sensitive internal detail'), {
  statusCode: 500,
});

export const expectedErrorPayload = (error: string): ErrorPayload => ({
  success: false,
  error,
});
