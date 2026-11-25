import test from "node:test";
import { assertConsumerPin } from "@dustwave/test-core/consumer-pin";
test("shared code and lockfile retain the reviewed immutable platform pin", () => {
  assertConsumerPin({
    root: process.cwd(),
    expectedCommit: "2dc1b4348617b72202029ffe87e2a28b28fc7f79",
    packages: {
      "worker-core": "0.21.0",
      "admin-shell": "0.20.2",
      "test-core": "0.6.0",
    },
    lockfiles: [
      {
        path: "package-lock.json",
        packages: {
          "shared/dust-wave-platform/packages/worker-core": "0.21.0",
          "shared/dust-wave-platform/packages/admin-shell": "0.20.2",
          "shared/dust-wave-platform/packages/test-core": "0.6.0",
        },
      },
    ],
  });
});
