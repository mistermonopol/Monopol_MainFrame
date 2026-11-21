# Set up two-factor sign-in

Both web and Android require your personal password and a six-digit code from an authenticator app. There is no password-only sign-in or recovery endpoint. This setup uses TOTP, not a passkey.

1. On a trusted computer, generate a private authenticator secret with Python. Do not paste the output into chat, CI, or Git:

   ```sh
   python -c "import base64, secrets; print(base64.b32encode(secrets.token_bytes(20)).decode())"
   ```

2. In your authenticator app, add an entry manually named **Monopol_MainFrame**, using the generated secret as the setup key. Choose **Time based (TOTP)**, **6 digits**, **30 seconds**, and **SHA-1** if asked. Keep a secure backup of the secret separate from your password, and enable automatic time on the phone and server.
3. Set `ADMIN_TOTP_SECRET` to the generated secret in Coolify (enable build and runtime visibility for Compose interpolation), or in the API environment for another deployment. With standalone Docker Compose, put it in the `.env` file passed to the API and migration containers. Keep `ADMIN_PASSWORD` configured. The API will not start without a valid authenticator secret.
4. Update Android to **0.10.2** or later using the same signing key as the installed app. Redeploy the server and sign in again on each client; sessions issued before MFA no longer work. Old versions of the Android app cannot log in to the updated API. Existing server data is not deleted.

If Android rejects the APK as an update because it was signed with a different key, build with the original signing key. To test without uninstalling the original app, run `sh android/gradlew -p android assemblePreview` and install `android/app/build/outputs/apk/preview/app-preview.apk` as **Monopol_MainFrame Preview**. This is a separate debug-signed app with its own local settings and session, not an update. It still requires Android 14 or later.

The workspace opens only after the server accepts a session. On a fresh launch without a confirmed session, an offline device stays on the sign-in screen.

If both clients reject fresh codes, compare the actual UTC time on the host running the API with a trusted clock. The Docker container uses the host clock. On a systemd host, check `timedatectl status`, enable its configured time-sync service with `sudo timedatectl set-ntp true` if it is off, and confirm it is synchronized. If the host uses chrony, check `chronyc tracking` instead. Do not widen the MFA acceptance window to work around a bad clock. If clocks agree, verify that the authenticator entry and `ADMIN_TOTP_SECRET` use the same setup key.

A code can only be used once across both clients. If you sign in on the web and then on Android, wait for the authenticator to display a new code. Five invalid sign-in attempts in one minute trigger a shared limit in the API process. Run one API replica unless you also enforce a shared rate limit upstream.

If you lose the authenticator and have no backup, use your deployment administrator access to generate and enroll a fresh secret, replace `ADMIN_TOTP_SECRET`, and redeploy. Changing the secret or password invalidates all existing app sessions.
