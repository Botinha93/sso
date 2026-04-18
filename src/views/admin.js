const state = {
  refreshToken: null,
  accessToken: null
};

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed");
  }

  return payload;
};

const mountList = (targetId, items, renderItem) => {
  const target = document.getElementById(targetId);
  target.innerHTML = "";

  if (!items.length) {
    target.innerHTML = '<div class="stack-item"><p>No records yet.</p></div>';
    return;
  }

  for (const item of items) {
    const wrapper = document.createElement("article");
    wrapper.className = "stack-item";
    wrapper.innerHTML = renderItem(item);
    target.appendChild(wrapper);
  }
};

const logActivity = (message) => {
  const target = document.getElementById("activity-log");
  const entry = document.createElement("article");
  entry.className = "stack-item";
  entry.innerHTML = `<p>${message}</p>`;
  target.prepend(entry);
};

const updateMetrics = ({ users, roles, tenants, clients }) => {
  document.getElementById("metric-users").textContent = String(users.length);
  document.getElementById("metric-roles").textContent = String(roles.length);
  document.getElementById("metric-tenants").textContent = String(tenants.length);
  document.getElementById("metric-clients").textContent = String(clients.length);
};

const loadDashboard = async () => {
  const [users, roles, tenants, clients] = await Promise.all([
    request("/users"),
    request("/roles"),
    request("/tenants"),
    request("/clients")
  ]);

  updateMetrics({ users, roles, tenants, clients });

  mountList("users-list", users, (user) => `
    <h5>${user.username}</h5>
    <p>${user.email}</p>
    <div class="meta">${(user.roles ?? []).map((role) => `<span>${role}</span>`).join("")}</div>
  `);

  mountList("roles-list", roles, (role) => `
    <h5>${role.name}</h5>
    <p>${role.description}</p>
    <div class="meta">
      <span>${role.scope}</span>
      ${role.permissions.map((permission) => `<span>${permission}</span>`).join("")}
    </div>
  `);

  mountList("tenants-list", tenants, (tenant) => `
    <h5>${tenant.name}</h5>
    <p>${tenant.slug}</p>
    <div class="meta"><span>${tenant.id}</span></div>
  `);

  mountList("clients-list", clients, (client) => `
    <h5>${client.name}</h5>
    <p>${client.id}</p>
    <div class="meta">
      <span>${client.requirePkce ? "PKCE required" : "PKCE optional"}</span>
      <span>${client.secretPreview}</span>
      ${client.allowedScopes.map((scope) => `<span>${scope}</span>`).join("")}
    </div>
  `);
};

const formDataToJson = (form) => Object.fromEntries(new FormData(form).entries());

const bindForms = () => {
  document.getElementById("user-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = formDataToJson(event.currentTarget);
    await request("/users", {
      method: "POST",
      body: JSON.stringify({
        ...raw,
        roleIds: String(raw.roleIds ?? "").split(",").map((value) => value.trim()).filter(Boolean)
      })
    });
    event.currentTarget.reset();
    logActivity("User created.");
    await loadDashboard();
  });

  document.getElementById("role-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = formDataToJson(event.currentTarget);
    await request("/roles", {
      method: "POST",
      body: JSON.stringify({
        ...raw,
        permissions: String(raw.permissions).split(",").map((value) => value.trim()).filter(Boolean)
      })
    });
    event.currentTarget.reset();
    logActivity("Role created.");
    await loadDashboard();
  });

  document.getElementById("tenant-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await request("/tenants", {
      method: "POST",
      body: JSON.stringify(formDataToJson(event.currentTarget))
    });
    event.currentTarget.reset();
    logActivity("Tenant created.");
    await loadDashboard();
  });

  document.getElementById("assignment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = formDataToJson(event.currentTarget);
    await request("/role-assignments", {
      method: "POST",
      body: JSON.stringify({
        userId: raw.userId,
        roleId: raw.roleId,
        tenantId: raw.tenantId || undefined
      })
    });
    logActivity("Role assignment saved.");
    event.currentTarget.reset();
    await loadDashboard();
  });

  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = formDataToJson(event.currentTarget);
    const payload = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: raw.email,
        password: raw.password,
        clientId: raw.clientId,
        tenantSlug: raw.tenantSlug || undefined,
        scope: String(raw.scope).split(",").map((value) => value.trim()).filter(Boolean)
      })
    });
    state.refreshToken = payload.refreshToken;
    state.accessToken = payload.accessToken;
    document.getElementById("token-output").textContent = JSON.stringify(payload, null, 2);
    logActivity("Token set minted from login.");
  });

  document.getElementById("refresh-button").addEventListener("click", async () => {
    if (!state.refreshToken) {
      logActivity("Login first to rotate a refresh token.");
      return;
    }

    const payload = await request("/oauth/token", {
      method: "POST",
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: state.refreshToken,
        client_id: "sso-admin-ui",
        client_secret: "super-secret-admin-client"
      })
    });
    state.refreshToken = payload.refreshToken;
    state.accessToken = payload.accessToken;
    document.getElementById("token-output").textContent = JSON.stringify(payload, null, 2);
    logActivity("Refresh token rotated.");
  });

  for (const button of document.querySelectorAll("[data-refresh]")) {
    button.addEventListener("click", () => {
      void loadDashboard();
      logActivity("Dashboard data refreshed.");
    });
  }
};

void loadDashboard();
bindForms();
