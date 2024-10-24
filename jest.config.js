export default {
  testEnvironment: "node",
  transform: {
    "^.+.tsx?$": ["ts-jest", { isolatedModules: true }],
  },
};
