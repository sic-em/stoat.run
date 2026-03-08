import { Command } from "commander";
import { httpCommand } from "./commands/http.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("stoat")
  .description("Share your localhost in one command")
  .version("0.1.0");

program
  .command("http")
  .description("Expose a local HTTP server")
  .argument("<port>", "local port to expose")
  .option("--slug <slug>", "request a specific slug")
  .option("--auth <user:pass>", "require basic auth for public access")
  .option("--expiry <seconds>", "session expiry in seconds")
  .action(
    async (
      port: string,
      options: { slug?: string; auth?: string; expiry?: string }
    ) => {
    await httpCommand(port, {
      slug: options.slug,
      auth: options.auth,
      expiry: options.expiry,
    });
    }
  );

program
  .command("status")
  .description("Show the current tunnel status")
  .action(async () => {
    await statusCommand();
  });

void program.parseAsync(process.argv);
