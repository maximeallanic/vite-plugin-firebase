import { ViteDevServer } from "vite";
// @ts-ignore
import { setupLoggers } from 'firebase-tools/lib/utils.js';
// @ts-ignore
import { getProjectDefaultAccount } from 'firebase-tools/lib/auth.js';
// @ts-ignore
import { Config } from 'firebase-tools/lib/config.js';
// @ts-ignore
import { setActiveAccount } from 'firebase-tools/lib/auth.js';

// @ts-ignore
import { requireAuth } from 'firebase-tools/lib/requireAuth.js';
import {
  startAll,
  cleanShutdown,
  exportOnExit
  // @ts-ignore
} from 'firebase-tools/lib/emulator/controller.js';
// @ts-ignore
import { shutdownWhenKilled } from 'firebase-tools/lib/emulator/commandUtils.js';

export interface FirebasePluginOptions {
  projectId: string | ((server: ViteDevServer) => string)
  projectName?: string | ((server: ViteDevServer) => string)
  root?: string
  materializeConfig?: boolean
  exportPath?: string
  targets: string[]
  showUI: boolean
}

export default function firebasePlugin({ projectId, projectName = projectId, root, materializeConfig, targets = ['hosting', 'functions'], showUI = false, exportPath }: FirebasePluginOptions) {
  return {
    name: "vite:firebase",
    async configureServer(server: ViteDevServer) {
      if (server.config.command !== 'serve') return;
      const projectDir = root || server.config.root;
      process.env.IS_FIREBASE_CLI = 'true';

      if (typeof projectId !== 'string') projectId = projectId(server);
      if (typeof projectName !== 'string') projectName = projectName(server);
      const account = getProjectDefaultAccount(projectDir);
      const options = {
        projectId,
        project: projectName,
        projectDir,
        nonInteractive: true,
        account,
        only: targets.join(','),
        targets,
        import: exportPath,
        exportOnExit: exportPath
      };

      const config = Config.load(options);

      setupLoggers();


      // @ts-ignore
      options.config = config;

      if (account) {
        setActiveAccount(options, account);
      }

      // patch server.close to close emulators as well
      const { close } = server;

      shutdownWhenKilled(options).then(() => {
        return close();
      });

      server.close = async () => {
        async function closeFirebase() {
          await exportOnExit(options);
          await cleanShutdown();
        }

        await Promise.all([close(), closeFirebase()]);
      }

      await startAll(options, showUI);
    },

  };
}

