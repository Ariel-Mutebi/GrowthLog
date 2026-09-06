import z from 'zod';
import zxcvbn from 'zxcvbn-ts';

export const schema = z.object({
  forename: z.string().trim().min(1, 'First name is required'),
  surname: z.string().trim().min(1, 'Last name is required'),
  email: z.email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
}).superRefine(({ forename, surname, email, password }, context) => {
  if (!password) return;

  const test = zxcvbn(password, [forename, surname, email].filter(Boolean));

  if (test.score < 3) {
    context.addIssue({
      code: 'custom',
      path: ['password'],
      message: test.feedback.warning,
    });
  }
});

export type SignUpData = z.infer<typeof schema>;
export type SignUpField = keyof SignUpData;
