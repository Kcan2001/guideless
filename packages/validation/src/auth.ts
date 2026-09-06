import { z } from "zod";
import { emailSchema } from "./common";

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), "Mix letters and numbers");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
  next: z.string().startsWith("/").optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1, "Tell us your name").max(120),
  next: z.string().startsWith("/").optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const magicLinkSchema = z.object({
  email: emailSchema,
  next: z.string().startsWith("/").optional(),
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
