import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";
import { hashPassword, MAX_PASSWORD_LENGTH, MAX_USERNAME_LENGTH } from "./auth.ts";

async function askSecret(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) {
    const reader = createInterface({ input: stdin, output: stdout });
    const answer = await reader.question(prompt);
    reader.close();
    return answer;
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  let answer = "";
  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) {
          stdin.setRawMode?.(false);
          stdin.off("data", onData);
          stdout.write("\n");
          process.exit(130);
        }
        if (byte === 13 || byte === 10) {
          stdin.setRawMode?.(false);
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(answer);
          return;
        }
        if (byte === 8 || byte === 127) {
          if (answer.length > 0) {
            answer = answer.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        answer += String.fromCharCode(byte);
        stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const reader = createInterface({ input: stdin, output: stdout });
  const username = (await reader.question("Usuario administrador [admin]: ")).trim() || "admin";
  reader.close();
  const password = await askSecret("Contraseña: ");
  const confirmation = await askSecret("Repite la contraseña: ");

  if (username.length > MAX_USERNAME_LENGTH) {
    throw new Error(`El usuario no puede superar ${MAX_USERNAME_LENGTH} caracteres.`);
  }
  if (password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`La contraseña debe tener entre 8 y ${MAX_PASSWORD_LENGTH} caracteres.`);
  }
  if (password !== confirmation) {
    throw new Error("Las contraseñas no coinciden.");
  }

  const passwordHash = hashPassword(password);
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (existing) {
    await db
      .update(usersTable)
      .set({ passwordHash, role: "admin", active: true })
      .where(eq(usersTable.id, existing.id));
    console.log(`Administrador "${username}" actualizado.`);
  } else {
    await db.insert(usersTable).values({
      username,
      passwordHash,
      role: "admin",
      active: true,
    });
    console.log(`Administrador "${username}" creado.`);
  }
}

try {
  await main();
} finally {
  await pool.end();
}
