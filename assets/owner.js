export function mountOwner() {
  if (window.top !== window.self) {
    document.querySelectorAll("[data-owner]").forEach((b) => (b.hidden = true));
    return;
  }
  const dialog = document.createElement("dialog");
  dialog.className = "dialog owner-dialog";
  dialog.setAttribute("aria-labelledby", "owner-title");
  dialog.innerHTML = `<button class="dialog-close" aria-label="Close owner sign-in" type="button">✕</button><div class="eyebrow">DEV WRAPPED / BACKSTAGE</div><h2 id="owner-title">Your story.<br>Your studio.</h2><p>Sign in to edit your portfolio. This space is just for the owner.</p><form><label for="owner-password">Admin password</label><input id="owner-password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button class="btn green" type="submit">Sign in to Studio →</button></form><p class="owner-status" role="status"></p>`;
  document.body.append(dialog);
  let trigger;
  const status = dialog.querySelector('[role="status"]');
  const submit = dialog.querySelector('[type="submit"]');
  dialog.querySelector(".dialog-close").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    dialog.querySelector("form").reset();
    trigger?.focus();
  });
  document.querySelectorAll("[data-owner]").forEach(
    (button) =>
      (button.onclick = async () => {
        trigger = button;
        button.disabled = true;
        try {
          const response = await fetch("/api/admin-auth", {
            cache: "no-store",
          });
          if (!response.ok) throw new Error();
          if ((await response.json()).authenticated) {
            location.assign("/admin/");
            return;
          }
          status.textContent = "";
        } catch {
          status.textContent =
            "Unable to check your session. You can try signing in below.";
        } finally {
          button.disabled = false;
        }
        dialog.showModal();
        dialog.querySelector("input").focus();
      }),
  );
  dialog.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = "Signing in…";
    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: dialog.querySelector("input").value }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not sign in. Please try again.");
      location.assign("/admin/");
    } catch (error) {
      status.textContent =
        error.message || "Connection failed. Please try again.";
    } finally {
      submit.disabled = false;
    }
  };
}
