import z from 'zod';
import zxcvbn from 'zxcvbn-ts';

const lettersOnly = /^[\p{L}]+$/u;

export const schema = z.object({
  forename: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .regex(lettersOnly, 'First name must contain letters only'),

  surname: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .regex(lettersOnly, 'Last name must contain letters only'),

  email: z.email('Please enter a valid email'),

  password: z.string().min(8, 'Password must be at least 8 characters'),
}).superRefine(({ forename, surname, email, password }, context) => {
  if (!password) return;

  const test = zxcvbn(password, [forename, surname, email].filter(Boolean));
  const message = test.feedback.warning !== 'Invalid input'
    ? test.feedback.warning
    : 'This password is too weak';

  if (test.score < 3) {
    context.addIssue({
      code: 'custom',
      path: ['password'],
      message,
    });
  }
});

export type SignUpData = z.infer<typeof schema>;
