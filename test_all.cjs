const http = require('http');

const URL = "http://localhost:8787";

async function fetchJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`${URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

async function testEndpoint(path, method, isPaid) {
  return new Promise((resolve) => {
    const req = http.request(`${URL}${path}`, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    }, (res) => {
      // Discard body
      res.on('data', () => {});
      res.on('end', () => {
        const expectedStatus = isPaid ? 402 : 400; // Paid should throw 402 Payment Required, free endpoints without body might throw 400 Bad Request
        
        let success = false;
        if (isPaid && res.statusCode === 402) {
            success = true;
        } else if (!isPaid && (res.statusCode === 200 || res.statusCode === 400)) {
            success = true;
        }

        if (success) {
            console.log(`\x1b[32mSuccess\x1b[0m: ${method} ${path} returned ${res.statusCode}`);
            resolve(true);
        } else {
            console.log(`\x1b[31mFail\x1b[0m: ${method} ${path} returned ${res.statusCode} (expected ${expectedStatus})`);
            resolve(false);
        }
      });
    });
    
    // We send an empty body to test the payment interceptor (or schema validation for free endpoints)
    req.write('{}');
    req.end();
    req.on('error', () => {
      console.log(`\x1b[31mFail\x1b[0m: ${method} ${path} network error`);
      resolve(false);
    });
  });
}

async function run() {
  console.log("Fetching OpenAPI spec...");
  const openapi = await fetchJson('/openapi.json');
  if (!openapi || !openapi.paths) {
    console.error("Failed to load OpenAPI spec from", URL);
    process.exit(1);
  }

  const paths = Object.keys(openapi.paths);
  console.log(`Found ${paths.length} paths to test.\n`);
  
  let failures = 0;
  
  const freeEndpoints = [
    '/credits/deposit',
    '/preflight',
    '/agent/request-data',
    '/agent/feedback'
  ];

  for (const path of paths) {
    const ops = openapi.paths[path];
    const isPaid = !freeEndpoints.includes(path);
    
    if (ops.post) {
      const ok = await testEndpoint(path, 'POST', isPaid);
      if (!ok) failures++;
    } else if (ops.get) {
      const ok = await testEndpoint(path, 'GET', isPaid);
      if (!ok) failures++;
    }
  }

  console.log(`\nTest run completed. Failures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

run();
