import crypto from "node:crypto";

export function createVipEntitlementProcessor({
  db,
  FieldValue,
  Timestamp,
  sendRconCommand,
  buildVipGrantCommand,
  buildVipRemoveCommand,
  durationMs,
  now = Date.now,
  createToken = () => crypto.randomUUID(),
  leaseMs = 30_000,
}) {
  if (!db || typeof db.runTransaction !== "function") throw new TypeError("db.runTransaction is required");
  if (!FieldValue || !Timestamp || typeof sendRconCommand !== "function") throw new TypeError("VIP processor dependencies are incomplete");
  if (typeof buildVipGrantCommand !== "function" || typeof buildVipRemoveCommand !== "function") throw new TypeError("VIP command builders are required");
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new RangeError("durationMs must be positive");
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new RangeError("leaseMs must be positive");

  async function processVipEntitlement(entitlementRef) {
    const token = createToken();
    const claim = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(entitlementRef);
      if (!snapshot.exists) return { kind: "return", status: "missing" };

      const data = snapshot.data();
      const currentTime = now();
      const expiresAt = data.expiresAt?.toMillis?.();
      if (data.status === "active" && Number.isFinite(expiresAt) && expiresAt > currentTime) {
        return { kind: "return", status: "active" };
      }
      if (!["grant_pending", "revoke_pending"].includes(data.status)) {
        return { kind: "return", status: data.status || "unknown" };
      }

      const processingUntil = data.processingUntil?.toMillis?.();
      if (Number.isFinite(processingUntil) && processingUntil > currentTime) {
        return { kind: "return", status: "processing" };
      }

      if (data.status === "grant_pending" && Number.isFinite(expiresAt) && expiresAt <= currentTime) {
        transaction.update(entitlementRef, {
          status: "revoke_pending",
          revokeToStatus: "expired",
          processingToken: FieldValue.delete(),
          processingUntil: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { kind: "retry" };
      }

      transaction.update(entitlementRef, {
        processingToken: token,
        processingUntil: Timestamp.fromMillis(currentTime + leaseMs),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { kind: "claimed", status: data.status, data };
    });

    if (claim.kind === "retry") return processVipEntitlement(entitlementRef);
    if (claim.kind !== "claimed") return claim.status;

    try {
      if (claim.status === "grant_pending") {
        await sendRconCommand(buildVipGrantCommand(claim.data.steamId64, claim.data.displayName), 7000);
      } else {
        await sendRconCommand(buildVipRemoveCommand(claim.data.steamId64), 7000);
      }
      await sendRconCommand("server.writecfg", 5000);

      const completion = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(entitlementRef);
        if (!snapshot.exists) return { status: "missing" };
        const current = snapshot.data();
        if (current.processingToken !== token) return { status: current.status || "unknown" };

        if (current.status !== claim.status) {
          transaction.update(entitlementRef, {
            processingToken: FieldValue.delete(),
            processingUntil: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          return { status: current.status || "unknown", changed: true };
        }

        if (claim.status === "grant_pending") {
          const expiresAt = current.expiresAt?.toMillis?.();
          if (Number.isFinite(expiresAt) && expiresAt <= now()) {
            transaction.update(entitlementRef, {
              status: "revoke_pending",
              revokeToStatus: "expired",
              processingToken: FieldValue.delete(),
              processingUntil: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            return { status: "revoke_pending", changed: true };
          }

          transaction.update(entitlementRef, {
            status: "active",
            grantedAt: current.grantedAt || FieldValue.serverTimestamp(),
            expiresAt: current.expiresAt || Timestamp.fromMillis(now() + durationMs),
            updatedAt: FieldValue.serverTimestamp(),
            revokeToStatus: FieldValue.delete(),
            processingToken: FieldValue.delete(),
            processingUntil: FieldValue.delete(),
          });
          return { status: "active" };
        }

        const targetStatus = current.revokeToStatus === "suspended" && !current.expiresAt
          ? "revoked"
          : (["expired", "suspended", "revoked"].includes(current.revokeToStatus) ? current.revokeToStatus : "expired");
        transaction.update(entitlementRef, {
          status: targetStatus,
          revokedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          revokeToStatus: FieldValue.delete(),
          processingToken: FieldValue.delete(),
          processingUntil: FieldValue.delete(),
        });
        return { status: targetStatus };
      });

      if (completion.changed && ["grant_pending", "revoke_pending"].includes(completion.status)) {
        return processVipEntitlement(entitlementRef);
      }
      return completion.status;
    } catch (error) {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(entitlementRef);
        if (snapshot.exists && snapshot.data().processingToken === token) {
          transaction.update(entitlementRef, {
            processingToken: FieldValue.delete(),
            processingUntil: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }).catch(() => {});
      throw error;
    }
  }

  return processVipEntitlement;
}
