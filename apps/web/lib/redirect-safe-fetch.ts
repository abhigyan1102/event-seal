export function createRedirectRejectingFetch(
  fetchFn: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) =>
    await fetchFn(input, {
      ...init,
      redirect: "error",
    });
}
