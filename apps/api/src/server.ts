import { buildApp } from './app';
import { buildProductionDependencies } from './dependencies';
import { env } from './env';

async function main(): Promise<void> {
  const app = await buildApp(buildProductionDependencies(env));
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
