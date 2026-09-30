import test from "node:test";
import { assertConsumerPin } from "@dustwave/test-core/consumer-pin";
test("shared code and lockfile retain the reviewed immutable platform pin", () => {
  assertConsumerPin({
    root: process.cwd(),
    expectedCommit: "0f84a675deb9577648b35ae0fd0ebed5e9abcb60",
    packages: {
      "worker-core": "0.15.0",
      "admin-shell": "0.12.0",
      "test-core": "0.3.1",
    },
    lockfiles: [
      {
        path: "package-lock.json",
        packages: {
          "shared/dust-wave-platform/packages/worker-core": "0.15.0",
          "shared/dust-wave-platform/packages/admin-shell": "0.12.0",
          "shared/dust-wave-platform/packages/test-core": "0.3.1",
        },
      },
    ],
  });
});
