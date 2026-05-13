import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import {
  publicUser,
  publicUserForViewer,
  composeDisplayName,
  type PrivacyLevelWire,
} from "../lib/serializers";
import { isInContacts } from "../lib/contacts";

const router = Router();

router.use(requireAuth);

async function loadPrivacyContext(targetUserId: string, viewerId: string | null) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId: targetUserId },
  });
  // areContacts: target юзер видит viewer-а в своих контактах
  const areContacts =
    viewerId !== null ? await isInContacts(targetUserId, viewerId) : false;
  return {
    viewerId,
    areContacts,
    settings: settings
      ? {
          privacyLastSeen: settings.privacyLastSeen as PrivacyLevelWire,
          privacyAvatar: settings.privacyAvatar as PrivacyLevelWire,
          privacyBio: settings.privacyBio as PrivacyLevelWire,
        }
      : null,
  };
}

const phoneRegex = /^\+?[0-9 ()-]{5,20}$/;
function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const sign = trimmed.startsWith("+") ? "+" : "";
  return sign + trimmed.replace(/\D/g, "");
}

const searchSchema = z.object({
  query: z.string().trim().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get("/search", async (req: AuthRequest, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.json({ users: [] });
  }
  const { query, limit } = parsed.data;
  const q = query.toLowerCase().replace(/^@/, "");

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: req.userId! } },
        {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    },
    take: limit,
    orderBy: { displayName: "asc" },
  });

  return res.json({ users: users.map(publicUser) });
});

const avatarUrlSchema = z
  .string()
  .max(250_000)
  .refine(
    (v) =>
      v === "" ||
      /^https?:\/\//i.test(v) ||
      /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v),
    { message: "Invalid avatar URL" }
  );

// PATCH /users/me — обновление профиля (всё кроме username).
const updateMeSchema = z.object({
  firstName: z.string().trim().min(1).max(64).optional(),
  lastName: z.string().trim().max(64).nullable().optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  birthday: z.string().datetime().nullable().optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(phoneRegex, "Invalid phone number")
    .optional(),
  avatarUrl: avatarUrlSchema.nullable().optional(),
});

router.patch("/me", async (req: AuthRequest, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const data = parsed.data;
  const current = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!current) return res.status(404).json({ error: "User not found" });

  // Если меняем телефон — проверяем уникальность.
  if (data.phoneNumber !== undefined) {
    const normalized = normalizePhone(data.phoneNumber);
    if (normalized !== current.phoneNumber) {
      const exists = await prisma.user.findUnique({ where: { phoneNumber: normalized } });
      if (exists && exists.id !== current.id) {
        return res.status(409).json({ error: "Phone number already in use" });
      }
      data.phoneNumber = normalized;
    } else {
      data.phoneNumber = normalized;
    }
  }

  // Если меняли имя/фамилию — синхронизируем displayName.
  const nextFirstName = data.firstName ?? current.firstName;
  const nextLastName =
    data.lastName === undefined ? current.lastName : data.lastName;
  const displayName = composeDisplayName(nextFirstName, nextLastName);

  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      ...data,
      birthday: data.birthday === undefined ? undefined : data.birthday ? new Date(data.birthday) : null,
      displayName,
    },
  });

  return res.json({ user: publicUser(updated) });
});

// PATCH /users/me/username — отдельный endpoint с проверкой уникальности.
const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(4, "Username must be at least 4 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(/^[a-z0-9_]+$/, "Username can only contain letters, digits and underscore")
    .nullable(),
});

router.patch("/me/username", async (req: AuthRequest, res) => {
  const parsed = usernameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }
  const { username } = parsed.data;

  if (username !== null) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== req.userId) {
      return res.status(409).json({ error: "Username already taken" });
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: { username },
  });

  return res.json({ user: publicUser(updated) });
});

// ─── Settings ─────────────────────────────────────────────────────────
const privacyLevelEnum = z.enum(["everyone", "contacts", "nobody"]);

router.get("/me/settings", async (req: AuthRequest, res) => {
  let settings = await prisma.userSettings.findUnique({
    where: { userId: req.userId! },
  });
  if (!settings) {
    settings = await prisma.userSettings.create({ data: { userId: req.userId! } });
  }
  return res.json({
    settings: {
      privacyLastSeen: settings.privacyLastSeen,
      privacyAvatar: settings.privacyAvatar,
      privacyBio: settings.privacyBio,
      privacyMessages: settings.privacyMessages,
    },
  });
});

const updateSettingsSchema = z.object({
  privacyLastSeen: privacyLevelEnum.optional(),
  privacyAvatar: privacyLevelEnum.optional(),
  privacyBio: privacyLevelEnum.optional(),
  privacyMessages: privacyLevelEnum.optional(),
});

router.patch("/me/settings", async (req: AuthRequest, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, ...parsed.data },
    update: parsed.data,
  });
  return res.json({
    settings: {
      privacyLastSeen: settings.privacyLastSeen,
      privacyAvatar: settings.privacyAvatar,
      privacyBio: settings.privacyBio,
      privacyMessages: settings.privacyMessages,
    },
  });
});

// ─── Contacts ─────────────────────────────────────────────────────────
router.get("/me/contacts", async (req: AuthRequest, res) => {
  const rows = await prisma.contact.findMany({
    where: { ownerId: req.userId! },
    include: { contactUser: true },
    orderBy: { createdAt: "desc" },
  });
  const users = rows
    .map((r) => r.contactUser)
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => publicUser(u));
  return res.json({ users });
});

router.post("/:id/contact", async (req: AuthRequest, res) => {
  const target = req.params.id;
  if (target === req.userId) {
    return res.status(400).json({ error: "Cannot add yourself" });
  }
  const exists = await prisma.user.findUnique({ where: { id: target } });
  if (!exists) return res.status(404).json({ error: "User not found" });
  await prisma.contact.upsert({
    where: { ownerId_contactUserId: { ownerId: req.userId!, contactUserId: target } },
    create: { ownerId: req.userId!, contactUserId: target },
    update: {},
  });
  return res.status(204).end();
});

router.delete("/:id/contact", async (req: AuthRequest, res) => {
  const target = req.params.id;
  await prisma.contact
    .delete({
      where: { ownerId_contactUserId: { ownerId: req.userId!, contactUserId: target } },
    })
    .catch(() => undefined);
  return res.status(204).end();
});

// ─── Blocks ───────────────────────────────────────────────────────────
router.get("/me/blocked", async (req: AuthRequest, res) => {
  const rows = await prisma.blockedUser.findMany({
    where: { blockerId: req.userId! },
    include: { blocked: true },
    orderBy: { createdAt: "desc" },
  });
  const users = rows
    .map((r) => r.blocked)
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => publicUser(u));
  return res.json({ users });
});

router.post("/:id/block", async (req: AuthRequest, res) => {
  const target = req.params.id;
  if (target === req.userId) {
    return res.status(400).json({ error: "Cannot block yourself" });
  }
  const exists = await prisma.user.findUnique({ where: { id: target } });
  if (!exists) return res.status(404).json({ error: "User not found" });

  await prisma.blockedUser.upsert({
    where: { blockerId_blockedId: { blockerId: req.userId!, blockedId: target } },
    create: { blockerId: req.userId!, blockedId: target },
    update: {},
  });
  return res.status(204).end();
});

router.delete("/:id/block", async (req: AuthRequest, res) => {
  const target = req.params.id;
  await prisma.blockedUser
    .delete({
      where: { blockerId_blockedId: { blockerId: req.userId!, blockedId: target } },
    })
    .catch(() => undefined);
  return res.status(204).end();
});

// ─── Профиль ──────────────────────────────────────────────────────────
router.get("/:id", async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const ctx = await loadPrivacyContext(user.id, req.userId ?? null);
  return res.json({ user: publicUserForViewer(user, ctx) });
});

export default router;
