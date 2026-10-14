import { createTestContext, extractCookie } from "../tests/helpers/test-app.js";

const { app, admin } = await createTestContext("debug-risk");
const riskIp = "198.51.100.10";

const login = await app.inject({
  method: "POST",
  url: "/auth/login",
  headers: { "x-forwarded-for": riskIp },
  payload: {
    email: admin.email,
    password: admin.password,
    clientId: "sso-admin-ui",
    scope: ["openid", "profile", "email"]
  }
});

const sid = extractCookie(login.headers["set-cookie"], "sid");
const csrf = await app.inject({ method: "GET", url: "/api/csrf-token", headers: { cookie: sid } });
const cc = extractCookie(csrf.headers["set-cookie"], "csrf_token");
const ct = String(csrf.json().csrf_token);

const flows = await app.inject({ method: "GET", url: "/api/admin/authentication/flows", headers: { cookie: `${sid}; ${cc}` } });
const arr = flows.json() as Array<any>;
const active = arr.find((f) => f.designation === "authentication" && f.enabled);
const has = active.stages.some((s: any) => s.type === "risk_check");
const stages = has ? active.stages : [...active.stages, { type: "risk_check", required: true, order: active.stages.length + 1 }];

await app.inject({
  method: "PUT",
  url: `/api/admin/authentication/flows/${active.id}`,
  headers: { cookie: `${sid}; ${cc}`, "x-csrf-token": ct },
  payload: {
    name: active.name,
    description: active.description,
    designation: "authentication",
    enabled: true,
    grantTypes: active.grantTypes,
    stages
  }
});

for (let i = 0; i < 10; i += 1) {
  await app.inject({
    method: "POST",
    url: "/oauth/token",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": riskIp },
    payload: new URLSearchParams({
      grant_type: "password",
      username: `u${i}@x.com`,
      password: "bad",
      client_id: "sso-admin-ui",
      client_secret: "invalid-secret",
      scope: "openid"
    }).toString()
  });
}

const riskEventsResponse = await app.inject({ method: "GET", url: "/api/admin/security/risk-events?limit=50", headers: { cookie: sid } });
console.log("risk status", riskEventsResponse.statusCode, "len", riskEventsResponse.json().length);
console.log(riskEventsResponse.json().slice(0, 5));

const challenged = await app.inject({
  method: "POST",
  url: "/auth/login",
  headers: { "x-forwarded-for": riskIp },
  payload: {
    email: admin.email,
    password: admin.password,
    clientId: "sso-admin-ui",
    scope: ["openid", "profile", "email"]
  }
});

console.log("challenged", challenged.statusCode, challenged.body);
await app.close();
