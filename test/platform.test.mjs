import test from "node:test";
import { assertConsumerPin } from "@dustwave/test-core/consumer-pin";
test("shared code and lockfile retain the reviewed immutable platform pin", () => {
  assertConsumerPin({
    root: process.cwd(),
    expectedCommit: "dc8afe10ce7b07d7ff77e070b48096057a98d00c",
    packages: {
      "worker-core": "0.20.0",
      "admin-shell": "0.20.2",
      "test-core": "0.5.0",
    },
    lockfiles: [
      {
        path: "package-lock.json",
        packages: {
          "shared/dust-wave-platform/packages/worker-core": "0.20.0",
          "shared/dust-wave-platform/packages/admin-shell": "0.20.2",
          "shared/dust-wave-platform/packages/test-core": "0.5.0",
        },
      },
    ],
  });
});
