const esc = (v = "") =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let activeDialog;
async function request(body) {
  const response = await fetch("/api/admin-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      result.error || "Connection failed. Please try again.",
    );
    error.restart = result.restart;
    throw error;
  }
  return result;
}
export function openOwnerFlow(
  intent = "login",
  trigger = document.activeElement,
) {
  if (activeDialog?.open) return;
  if (!document.querySelector("#auth-styles")) {
    const link = document.createElement("link");
    link.id = "auth-styles";
    link.rel = "stylesheet";
    link.href = "/assets/auth.css";
    document.head.append(link);
  }
  const dialog = document.createElement("dialog");
  activeDialog = dialog;
  dialog.className = "mfa-dialog";
  dialog.setAttribute("aria-labelledby", "owner-title");
  document.body.append(dialog);
  let stage = "password",
    recovery = false,
    setup = null,
    codes = [],
    busy = false,
    completed = false;
  const purpose =
    intent === "replace"
      ? "Reconnect your authenticator"
      : intent === "backup"
        ? "Refresh your recovery codes"
        : "Your story. Your studio.";
  const notice = () => dialog.querySelector(".mfa-status");
  const field = () =>
    recovery
      ? `<label for="owner-code">Recovery code</label><input id="owner-code" class="recovery-input" autocomplete="off" spellcheck="false" required maxlength="24" placeholder="XXXXX-XXXXX-XXXXX-XXXXX">`
      : `<label for="owner-code">Authenticator code</label><input id="owner-code" class="otp-input" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" required maxlength="7" placeholder="000 000" aria-describedby="code-help"><small id="code-help">Six digits from Google Authenticator. Codes change every 30 seconds.</small>`;
  function render() {
    const index = stage === "password" ? 1 : stage === "recovery" ? 3 : 2;
    const title =
      stage === "password"
        ? purpose
        : stage === "enroll"
          ? "Add your second track."
          : stage === "verify"
            ? recovery
              ? "Your backup way in."
              : "One more beat."
            : "Keep these somewhere safe.";
    dialog.innerHTML = `<button class="mfa-close" type="button" aria-label="Close owner sign-in">✕</button><div class="mfa-brand"><span>▥</span> DEV WRAPPED <i>BACKSTAGE PASS</i></div><div class="mfa-art" aria-hidden="true"><div class="mfa-disc"><span>PRIVATE<br>PRESSING</span></div><div class="mfa-ticket">ONLY YOU.<br><b>ALL ACCESS.</b></div><span class="mfa-star">✳</span></div><div class="mfa-content"><div class="mfa-steps" aria-label="Sign-in progress"><span class="${index === 1 ? "current" : "complete"}">01 PASSWORD</span><i></i><span class="${index >= 2 ? "current" : ""}">02 AUTHENTICATOR</span></div><h2 id="owner-title">${esc(title)}</h2>${stage === "password" ? `<p>Your portfolio. Your private space. Sign in securely with your password and authenticator.</p>${intent !== "login" ? '<p class="mfa-callout">For your security, confirm both factors again. Existing sessions will be signed out when you finish.</p>' : ""}<form><label for="owner-password">Admin password</label><input id="owner-password" type="password" autocomplete="current-password" required maxlength="256"><button class="mfa-button" type="submit">Continue securely →</button></form>` : stage === "enroll" ? `<p>In <strong>Google Authenticator</strong>, tap <strong>＋ → Scan a QR code</strong>. Then enter the code below to confirm.</p><div class="mfa-qr"><img src="${esc(setup.qr)}" alt="Scan this QR code with Google Authenticator" width="220" height="220"></div><details class="manual-key"><summary>On the same phone? Enter a setup key instead</summary><p>Add a <strong>time-based</strong> key for <strong>Dev Wrapped — Portfolio owner</strong>.</p><code id="setup-secret">${esc(setup.secret)}</code><button type="button" class="mfa-link" data-copy-key>Copy setup key</button><small>Keep this key private. Never send it to anyone.</small></details><form>${field()}<button class="mfa-button" type="submit">Verify & enable protection →</button></form>` : stage === "verify" ? `<p>${recovery ? "Enter one of the recovery codes you saved during setup. Each code works only once." : "Open Google Authenticator and find your Dev Wrapped account."}</p><form>${field()}<button class="mfa-button" type="submit">${intent === "login" ? "Verify & enter Studio" : "Verify & continue"} →</button></form><button class="mfa-link" type="button" data-recovery>${recovery ? "Use my authenticator instead" : "Lost your phone? Use a recovery code"}</button><p class="mfa-fine">No app or recovery codes? Account recovery requires your Vercel project access. There is no password-only bypass.</p>` : `<p>These eight recovery codes can get you back in if you lose your phone. Each works once, alongside your password.</p><div class="recovery-codes">${codes.map((c) => `<code>${esc(c)}</code>`).join("")}</div><button class="mfa-secondary" type="button" data-download>↓ Download recovery codes</button><p class="mfa-callout">Store them in a password manager or somewhere private. They won’t be shown again.${intent === "backup" ? " Your previous codes no longer work." : ""}</p><label class="mfa-ack"><input type="checkbox" id="codes-saved"> I have saved my recovery codes</label><button class="mfa-button" type="button" data-done disabled>Enter my Studio →</button>`}<p class="mfa-status" role="status" aria-live="polite"></p>${stage !== "password" && stage !== "recovery" ? '<button type="button" class="mfa-link subdued" data-restart>← Start again</button>' : ""}<div class="mfa-footer">ENCRYPTED SESSION <span>•</span> YOUR PRIVATE EDITION</div></div>`;
    dialog.querySelector(".mfa-close").onclick = () => {
      if (!busy) dialog.close();
    };
    dialog.querySelector("[data-restart]")?.addEventListener("click", () => {
      stage = "password";
      setup = null;
      recovery = false;
      render();
    });
    dialog.querySelector("[data-recovery]")?.addEventListener("click", () => {
      recovery = !recovery;
      render();
    });
    dialog
      .querySelector("[data-copy-key]")
      ?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(setup.secret);
          notice().textContent = "Setup key copied. Treat it like a password.";
        } catch {
          notice().textContent =
            "Select the setup key above and copy it manually.";
        }
      });
    dialog.querySelector("[data-download]")?.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob(
          [
            "Dev Wrapped recovery codes\nKeep private. Each code works once, together with your password.\n\n" +
              codes.join("\n"),
          ],
          { type: "text/plain" },
        ),
      );
      a.download = "devwrapped-recovery-codes.txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    dialog
      .querySelector("#codes-saved")
      ?.addEventListener(
        "change",
        (e) =>
          (dialog.querySelector("[data-done]").disabled = !e.target.checked),
      );
    dialog.querySelector("[data-done]")?.addEventListener("click", () => {
      completed = true;
      location.assign("/admin/");
    });
    const form = dialog.querySelector("form");
    if (form)
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (busy) return;
        busy = true;
        form.querySelector("button[type=submit]").disabled = true;
        notice().textContent = "Checking securely…";
        try {
          const body =
            stage === "password"
              ? {
                  action: "password",
                  password: dialog.querySelector("input").value,
                  intent,
                }
              : {
                  action: stage,
                  code: dialog
                    .querySelector("#owner-code")
                    .value.replace(/\s/g, ""),
                  recovery,
                };
          const result = await request(body);
          if (!dialog.open) return;
          if (result.step === "enroll") {
            stage = "enroll";
            setup = result;
            recovery = false;
            render();
          } else if (result.step === "verify") {
            stage = "verify";
            setup = null;
            render();
          } else if (result.step === "recovery") {
            stage = "recovery";
            codes = result.recoveryCodes;
            setup = null;
            render();
          } else if (result.authenticated) {
            completed = true;
            location.assign("/admin/");
          }
        } catch (error) {
          if (error.restart) {
            stage = "password";
            setup = null;
            render();
          }
          if (dialog.open) notice().textContent = error.message;
        } finally {
          busy = false;
          const submit = dialog.querySelector("button[type=submit]");
          if (submit) submit.disabled = false;
        }
      };
    dialog.querySelector("input")?.focus();
  }
  dialog.addEventListener("cancel", (e) => {
    if (busy) e.preventDefault();
  });
  dialog.addEventListener("close", () => {
    if (
      stage === "recovery" &&
      !completed &&
      !dialog.querySelector("#codes-saved")?.checked
    ) {
      dialog.showModal();
      notice().textContent = "Please save your recovery codes before closing.";
      return;
    }
    setup = null;
    codes = [];
    dialog.innerHTML = "";
    dialog.remove();
    activeDialog = null;
    trigger?.focus();
    request({ action: "cancel" }).catch(() => {});
  });
  render();
  dialog.showModal();
  dialog.querySelector("input")?.focus();
}
export function mountOwner() {
  if (window.top !== window.self) {
    document.querySelectorAll("[data-owner]").forEach((b) => (b.hidden = true));
    return;
  }
  document.querySelectorAll("[data-owner]").forEach(
    (button) =>
      (button.onclick = async () => {
        button.disabled = true;
        try {
          const r = await fetch("/api/admin-auth", { cache: "no-store" });
          if (r.ok && (await r.json()).authenticated) {
            location.assign("/admin/");
            return;
          }
        } catch {
        } finally {
          button.disabled = false;
        }
        openOwnerFlow("login", button);
      }),
  );
}
