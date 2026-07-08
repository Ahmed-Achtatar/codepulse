import { ENDPOINTS } from "./src/endpoints/registry.js"

const mockCache = {
  put: async (key: string, value: string) => { console.log(`[Mock Cache] PUT ${key}`); },
  get: async (key: string) => { return null; }
};

const mockContext = {
  env: {
    CACHE: mockCache
  }
};

async function testAll() {
  console.log(`Found ${ENDPOINTS.length} endpoints to test.\n`);
  
  let success = 0;
  let failed = 0;

  for (const ep of ENDPOINTS) {
    console.log(`Testing [${ep.path}]...`);
    try {
      const input = ep.exampleInput();
      const output = await ep.logic(input, mockContext);
      
      // Basic check: did it return an object/string without throwing?
      if (output) {
        // console.log(`  Output:`, output);
        success++;
      } else {
        console.log(`  \x1b[33mWarning\x1b[0m: returned falsy value`);
        failed++;
      }
    } catch (e: any) {
      console.log(`  \x1b[31mFailed\x1b[0m: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${success} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

testAll().catch(e => {
  console.error("Fatal error:", e);
});
