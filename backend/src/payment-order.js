export async function persistCreatedVipOrder({
  db,
  orderRef,
  orderLockRef,
  idempotencyRef,
  orderId,
  providerTransactionId,
  providerStatus,
  redirectUrl,
  paymentMethod,
  FieldValue,
}) {
  return db.runTransaction(async (transaction) => {
    const [currentOrder, currentLock, currentRequest] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(orderLockRef),
      transaction.get(idempotencyRef),
    ]);
    if (!currentOrder.exists || currentOrder.data()?.status !== "creating") {
      throw new Error("Order is no longer in the creating state");
    }
    const order = currentOrder.data();
    const lock = currentLock.exists ? currentLock.data() : null;
    const request = currentRequest.exists ? currentRequest.data() : null;
    const now = Date.now();
    const orderExpiresAt = order.expiresAt?.toMillis?.();
    const lockExpiresAt = lock?.expiresAt?.toMillis?.();

    if (!Number.isFinite(orderExpiresAt) || orderExpiresAt <= now) {
      throw new Error("Order reservation has expired");
    }
    if (!request || request.orderId !== orderId || request.status !== "creating" || request.userId !== order.userId) {
      throw new Error("Payment idempotency record does not match the creating order");
    }
    if (!lock || lock.orderId !== orderId || lock.status !== "creating" || lock.userId !== order.userId ||
        !Number.isFinite(lockExpiresAt) || lockExpiresAt <= now) {
      throw new Error("Checkout lock is no longer reserved for this order");
    }

    transaction.update(orderRef, {
      status: "pending",
      provider: "platega",
      providerTransactionId,
      providerStatus: providerStatus || "PENDING",
      redirectUrl,
      paymentMethod,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(orderLockRef, {
      status: "pending",
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(idempotencyRef, {
      status: "created",
      redirectUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
