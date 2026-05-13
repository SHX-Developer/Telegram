import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { publicUser, composeDisplayName } from "../lib/serializers";

const router = Router();

const phoneRegex = /^\+?[0-9 ()-]{5,20}$/;

// Нормализуем телефон: оставляем цифры и ведущий "+"
function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const sign = trimmed.startsWith("+") ? "+" : "";
  return sign + trimmed.replace(/\D/g, "");
}

const registerSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .min(5, "Phone number is too short")
    .max(20)
    .regex(phoneRegex, "Invalid phone number format"),
  firstName: z.string().trim().min(1, "First name is required").max(64),
  lastName: z.string().trim().max(64).optional(),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }
  const { phoneNumber, firstName, lastName, password } = parsed.data;
  const normalizedPhone = normalizePhone(phoneNumber);

  const existing = await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } });
  if (existing) {
    return res.status(409).json({ error: "Phone number already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const displayName = composeDisplayName(firstName, lastName);
  const user = await prisma.user.create({
    data: {
      phoneNumber: normalizedPhone,
      firstName,
      lastName: lastName || null,
      displayName,
      passwordHash,
    },
  });

  const token = signToken({ userId: user.id });
  return res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { identifier, password } = parsed.data;

  // identifier может быть номером телефона или username.
  // Угадаем по наличию букв.
  const isPhone = /[+0-9 ()-]/.test(identifier) && !/[A-Za-z_]/.test(identifier);
  const normalizedPhone = isPhone ? normalizePhone(identifier) : null;
  const usernameCandidate = !isPhone ? identifier.toLowerCase().replace(/^@/, "") : null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(normalizedPhone ? [{ phoneNumber: normalizedPhone }] : []),
        ...(usernameCandidate ? [{ username: usernameCandidate }] : []),
      ],
    },
  });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  const token = signToken({ userId: user.id });
  return res.json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json({ user: publicUser(user) });
});

export default router;
