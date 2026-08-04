import z from 'zod';
import zxcvbn from 'zxcvbn-ts';

export const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
}).superRefine(({ firstName, lastName, email, password }, context) => {
  if (!password) return;

  const test = zxcvbn(password, [firstName, lastName, email].filter(Boolean));

  if (test.score < 3) {
    context.addIssue({
      code: 'custom',
      path: ['password'],
      message: test.feedback.warning || 'This password is too weak',
    });
  }
});

export type SignUpField = keyof z.infer<typeof schema>;
