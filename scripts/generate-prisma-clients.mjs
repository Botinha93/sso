import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const prismaDir = join(projectRoot, "prisma");
const templatePath = join(prismaDir, "schema.template.prisma");
const generatedRoot = join(projectRoot, "src", "generated", "prisma");

const template = readFileSync(templatePath, "utf8");

const providers = [
  {
    name: "sqlite",
    provider: "sqlite",
    output: "../src/generated/prisma/sqlite",
    databaseUrl: "file:./data/sso.sqlite"
  },
  {
    name: "postgresql",
    provider: "postgresql",
    output: "../src/generated/prisma/postgresql",
    databaseUrl: "postgresql://user:pass@localhost:5432/sso"
  },
  {
    name: "mysql",
    provider: "mysql",
    output: "../src/generated/prisma/mysql",
    databaseUrl: "mysql://user:pass@localhost:3306/sso"
  }
];

mkdirSync(generatedRoot, { recursive: true });

for (const { name, provider, output, databaseUrl } of providers) {
  const schemaPath = join(prismaDir, `schema.${name}.generated.prisma`);
  const schema = template
    .replaceAll("__PROVIDER__", provider)
    .replaceAll("__OUTPUT_DIR__", output);

  rmSync(join(generatedRoot, name), { recursive: true, force: true });
  writeFileSync(schemaPath, schema, "utf8");

  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["prisma", "generate", "--schema", schemaPath],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl
      }
    }
  );

  unlinkSync(schemaPath);
}