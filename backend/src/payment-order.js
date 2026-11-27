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
    if (!currentRequest.exists || currentRequest.data()?.orderId !== orderId) {
      throw new Error("Payment idempotency record does not match the order");
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
    if (currentLock.exists && currentLock.data()?.orderId === orderId) {
      transaction.update(orderLockRef, {
        status: "pending",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    transaction.update(idempotencyRef, {
      status: "created",
      redirectUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
