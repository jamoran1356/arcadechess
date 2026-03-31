import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

const SESSION_COOKIE = "playchess_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

function getAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function hasAdminAccess(session: SessionUser | null) {
  if (!session) {
    return false;
  }

  if (session.role === UserRole.ADMIN) {
    return true;
  }

  if (getAdminEmails().has(session.email.toLowerCase())) {
    return true;
  }

  return process.env.NODE_ENV !== "production";
}

function getSessionKey() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "playchess-development-secret-change-me",
  );
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionKey());
    if (!payload.sub || !payload.email || !payload.name || !payload.role) {
      return null;
    }

    return {
      id: payload.sub,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as UserRole,
    } satisfies SessionUser;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (!hasAdminAccess(session)) {
    redirect("/dashboard");
  }

  return session;
}
