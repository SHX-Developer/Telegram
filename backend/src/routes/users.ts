import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { publicUser } from "../lib/serializers";

const router = Router();

router.use(requireAuth);

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
  const q = query.toLowerCase();

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: req.userId! } },
        {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    },
    take: limit,
    orderBy: { username: "asc" },
  });

  return res.json({ users: users.map(publicUser) });
});

// Допускаем и URL (http/https), и data URL с картинкой (для base64-аватарок,
// загружаемых из ProfilePanel с client-side ресайзом). Лимит ~250КБ на строку,
// этого достаточно для 256×256 JPEG с приличным качеством.
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

const updateMeSchema = z.object({
  displayName: z.string().trim().min(1).max(64).optional(),
  avatarUrl: avatarUrlSchema.nullable().optional(),
});

router.patch("/me", async (req: AuthRequest, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: parsed.data,
  });

  return res.json({ user: publicUser(updated) });
});

router.get("/:id", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json({ user: publicUser(user) });
});

export default router;
