/**
 * NOTE:
 * The app currently treats connectivity as always available and only provides a manual retry.
 * Using React hooks here is unnecessary and can trigger "hook dispatcher is null" issues
 * in environments where React gets evaluated outside the expected render lifecycle.
 */
export const useCapacitorConnection = () => {
  const retry = () => {
    window.location.reload();
  };

  return { isOnline: true, isLoading: false, retry };
};
